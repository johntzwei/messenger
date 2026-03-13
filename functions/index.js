const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { defineSecret } = require("firebase-functions/params");

const ADMIN_KEY = defineSecret("ADMIN_KEY");

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
    const db = getFirestore();

    // Only notify users who were @mentioned
    const mentionedUserIds = await parseMentionedUserIds(db, text);
    if (mentionedUserIds.size === 0) return;

    // Don't notify the sender even if they @mentioned themselves
    mentionedUserIds.delete(senderId);

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
