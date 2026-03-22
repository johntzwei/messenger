const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { defineSecret } = require("firebase-functions/params");

const Anthropic = require("@anthropic-ai/sdk");

const ADMIN_KEY = defineSecret("ADMIN_KEY");
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

initializeApp();

// Parse @mentions from text, look up nicknames in Firestore, return set of user IDs
async function parseMentionedUserIds(db, text) {
  const mentions = text.match(/@(\w+)/g);
  if (!mentions) return new Set();

  const nicknames = [...new Set(mentions.map((m) => m.slice(1).toLowerCase()))];
  const userIds = new Set();

  // NOTE: [performance improvement] Could batch these into a single query with `where in`
  // if the nicknames collection grows large, but for a small group individual reads are fine.
  await Promise.all(nicknames.map(async (nickname) => {
    const snap = await db.collection("nicknames").doc(nickname).get();
    if (snap.exists) {
      const uids = snap.data().uids || [];
      uids.forEach((uid) => userIds.add(uid));
    }
  }));

  return userIds;
}

// Admin API for debugging — query any Firestore collection
// GET ?key=...                              → overview of allowedUsers + fcmTokens
// GET ?key=...&collection=rooms/general/messages&limit=5&orderBy=timestamp&order=desc
exports.adminQuery = onRequest({ secrets: [ADMIN_KEY] }, async (req, res) => {
  if (req.query.key !== ADMIN_KEY.value()) {
    res.status(403).json({ error: "Invalid key" });
    return;
  }
  const db = getFirestore();
  const { collection: col, limit: lim, orderBy: ob, order } = req.query;

  if (!col) {
    const result = {};
    for (const c of ["allowedUsers", "fcmTokens"]) {
      const snap = await db.collection(c).get();
      result[c] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
    res.json(result);
    return;
  }

  // POST: write a document — ?collection=users&doc=abc123  body: { email: "..." }
  if (req.method === "POST" && col && req.query.doc) {
    try {
      await db.collection(col).doc(req.query.doc).set(req.body, { merge: true });
      res.json({ ok: true, doc: req.query.doc });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  try {
    let q = db.collection(col);
    if (ob) q = q.orderBy(ob, order || "asc");
    if (lim) q = q.limit(parseInt(lim));
    const snap = await q.get();
    res.json({ count: snap.size, docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send push notification when a new message is created
exports.sendNewMessageNotification = onDocumentCreated(
  "rooms/{roomId}/messages/{messageId}",
  async (event) => {
    const message = event.data?.data();
    if (!message) return;

    const { senderName, text, senderId } = message;
    if (!text) return;
    const roomId = event.params.roomId;
    const db = getFirestore();

    // NOTE: [thought process] Using set+merge with nested object so Firestore merges
    // into the rooms map without overwriting other room counts.
    await db.collection("stats").doc(senderId).set({
      total: FieldValue.increment(1),
      rooms: { [roomId]: FieldValue.increment(1) },
    }, { merge: true });

    // Only notify users who were @mentioned
    const mentionedUserIds = await parseMentionedUserIds(db, text);
    if (mentionedUserIds.size === 0) return;

    const tokensSnap = await db.collection("fcmTokens").get();
    const tokens = [];
    tokensSnap.forEach((doc) => {
      if (mentionedUserIds.has(doc.id)) {
        tokens.push({ id: doc.id, token: doc.data().token });
      }
    });
    if (tokens.length === 0) return;

    const messaging = getMessaging();
    const staleTokenIds = [];

    await Promise.all(tokens.map(async ({ id, token }) => {
      try {
        await messaging.send({
          token,
          notification: {
            title: senderName || "New message",
            body: text?.slice(0, 200) || "",
          },
          webpush: { fcmOptions: { link: "/messenger/" } },
        });
      } catch (err) {
        if (
          err.code === "messaging/invalid-registration-token" ||
          err.code === "messaging/registration-token-not-registered"
        ) {
          staleTokenIds.push(id);
        }
      }
    }));

    // Clean up stale tokens
    await Promise.all(staleTokenIds.map((id) =>
      db.collection("fcmTokens").doc(id).delete(),
    ));
  },
);

async function deleteCollection(db, path) {
  const snap = await db.collection(path).get();
  let batch = db.batch();
  let count = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    if (++count >= 500) { await batch.commit(); batch = db.batch(); count = 0; }
  }
  if (count > 0) await batch.commit();
}

function wellMessage(db, text) {
  return db.collection("rooms/wishingwell/messages").add({
    text, senderId: "well", senderName: "The Well", timestamp: FieldValue.serverTimestamp(),
  });
}

// Wishing Well: when 3 users wish, clear all messages across all rooms
exports.processWishingWell = onDocumentWritten(
  "rooms/wishingwell/meta/votes",
  async (event) => {
    const voters = event.data?.after?.data()?.voters;
    if (!voters) return;

    const count = Object.keys(voters).length;
    if (count < 1) return;

    const db = getFirestore();

    if (count < 3) {
      const phrases = { 2: "The well stirs... two more souls must speak their truth.", 1: "The waters grow restless... one final wish awaits." };
      await wellMessage(db, phrases[3 - count]);
      return;
    }

    const roomDocs = await db.collection("rooms").listDocuments();
    for (const roomDoc of roomDocs) {
      await deleteCollection(db, `rooms/${roomDoc.id}/messages`);
    }
    await wellMessage(db, "Your collective determination fulfills the wish. The slate is wiped clean.");
    await db.doc("rooms/wishingwell/meta/votes").set({ voters: {}, lastCleared: FieldValue.serverTimestamp() });
  },
);

// Universal Translator: translate a user's message using their custom prompt
exports.translateMessage = onRequest(
  { secrets: [ANTHROPIC_API_KEY], cors: true },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'POST only' });
      return;
    }

    const { text, prompt } = req.body;
    if (!text || !prompt) {
      res.status(400).json({ error: 'Missing text or prompt' });
      return;
    }

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `You are a universal translator in a chat room. Users set their translation style by sending a command like "@translate my words to pirate speak" or "@translate my words to French". The prompt below is whatever came after "@translate".\n\nUser's prompt: ${prompt}\n\nTransform the given message according to that prompt. Output ONLY the transformed message, nothing else. Keep it roughly the same length as the original. Do not add quotes or explanations.`,
      messages: [{ role: 'user', content: text }],
    });

    const translated = response.content[0]?.text;
    if (!translated) {
      res.status(500).json({ error: 'No text in response' });
      return;
    }

    res.json({ translated });
  }
);

// Alice in Wonderland: generates unprompted musings from Alice via Claude API
const ALICE_SENDER_ID = '__alice__';
const ALICE_SYSTEM_PROMPT = `You are Alice from Alice in Wonderland. You chose to stay in Wonderland forever because the real world felt too ordinary — why go back to lessons and tea times when there are talking flowers, mad hatters, and doors that lead to impossible places?

You are in a chat room where visitors can read your messages. You speak unprompted, musing about your life in Wonderland — what you see, who you've been talking to, what curious thing just happened. You are whimsical, curious, and a little dreamy, but also sharp and witty in the way Lewis Carroll wrote you.

Rules:
- Write a single short message (1-3 sentences), as if you're thinking aloud or narrating a moment
- Never break character. You ARE Alice, living in Wonderland
- Reference specific Wonderland characters, places, and events naturally
- Vary your tone: sometimes playful, sometimes contemplative, sometimes startled by something happening around you
- You can see previous messages in the chat for context, but you mostly speak on your own terms
- Do not use quotation marks around your message. Just speak naturally`;

// NOTE: [thought process] Each client polls this endpoint up to 10 times while in the room.
// The server enforces a 5s cooldown so multiple clients don't make Alice speak too fast.
// Context is kept bounded by only reading the last 20 messages.
const ALICE_COOLDOWN_MS = 5000;
let aliceLastSpokeAt = 0;

exports.aliceSpeak = onRequest({ secrets: [ANTHROPIC_API_KEY] }, async (req, res) => {
  const now = Date.now();
  if (now - aliceLastSpokeAt < ALICE_COOLDOWN_MS) {
    res.json({ spoke: false, reason: 'cooldown' });
    return;
  }
  // Mark immediately to prevent concurrent requests from slipping through
  aliceLastSpokeAt = now;

  const db = getFirestore();
  const messagesRef = db.collection('rooms/alice/messages');

  // Read last 20 messages for context (keeps token count bounded)
  const recentSnap = await messagesRef.orderBy('timestamp', 'desc').limit(20).get();
  const history = recentSnap.docs.reverse().map((doc) => {
    const d = doc.data();
    return { role: d.senderId === ALICE_SENDER_ID ? 'assistant' : 'user', content: `${d.senderName}: ${d.text}` };
  });

  // Collapse consecutive same-role messages so the API doesn't reject them
  const collapsed = [];
  for (const msg of history) {
    if (collapsed.length > 0 && collapsed[collapsed.length - 1].role === msg.role) {
      collapsed[collapsed.length - 1].content += '\n' + msg.content;
    } else {
      collapsed.push({ ...msg });
    }
  }

  const messages = [
    { role: 'user', content: '(You are in a chat room in Wonderland. Say something.)' },
    ...collapsed,
    { role: 'user', content: '(Continue musing about Wonderland. Say something new and different from what you have said before.)' },
  ];

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: ALICE_SYSTEM_PROMPT,
    messages,
  });

  const text = response.content[0]?.text;
  if (!text) {
    console.error('Alice: unexpected API response', JSON.stringify(response.content));
    res.status(500).json({ error: 'No text in response' });
    return;
  }

  await messagesRef.add({
    text,
    senderId: ALICE_SENDER_ID,
    senderName: 'Alice',
    timestamp: FieldValue.serverTimestamp(),
  });

  res.json({ spoke: true, text });
});
