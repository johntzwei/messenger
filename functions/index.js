const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

// Triggered when a new message is added to any room
exports.sendNewMessageNotification = onDocumentCreated(
  "rooms/{roomId}/messages/{messageId}",
  async (event) => {
    const message = event.data?.data();
    if (!message) return;

    const { senderName, text, senderId } = message;
    const db = getFirestore();

    // Get all FCM tokens (except the sender's)
    const tokensSnap = await db.collection("fcmTokens").get();
    const tokens = [];
    const staleTokenIds = [];

    tokensSnap.forEach((doc) => {
      if (doc.id !== senderId) {
        tokens.push({ id: doc.id, token: doc.data().token });
      }
    });

    if (tokens.length === 0) return;

    // Send notification to each token
    const messaging = getMessaging();
    const sendPromises = tokens.map(async ({ id, token }) => {
      try {
        await messaging.send({
          token,
          notification: {
            title: senderName || "New message",
            body: text?.slice(0, 200) || "",
          },
          webpush: {
            fcmOptions: { link: "/messenger/" },
          },
        });
      } catch (err) {
        // Remove invalid/expired tokens
        if (
          err.code === "messaging/invalid-registration-token" ||
          err.code === "messaging/registration-token-not-registered"
        ) {
          staleTokenIds.push(id);
        }
      }
    });

    await Promise.all(sendPromises);

    // Clean up stale tokens
    const deletePromises = staleTokenIds.map((id) =>
      db.collection("fcmTokens").doc(id).delete(),
    );
    await Promise.all(deletePromises);
  },
);
