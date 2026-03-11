import { useEffect, useState } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { doc, setDoc, deleteDoc, Firestore } from "firebase/firestore";
import { messagingPromise } from "./firebase";

// VAPID key — you generate this in Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
// Replace this placeholder after generating yours
const VAPID_KEY = "BNwift-YlFkht9Iw4CDxpK_Ax3CoR-gIlA4WjrpCyW6RmZkY7OPfEcdBfy468BKLpusL0Pkr422LfE7FFAJTK8c";

export function useNotifications(db: Firestore, userId: string | null) {
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [supported, setSupported] = useState(typeof Notification !== "undefined");

  // Listen for foreground messages and show a notification
  useEffect(() => {
    let unsub: (() => void) | undefined;
    messagingPromise.then((messaging) => {
      if (!messaging) {
        setSupported(false);
        return;
      }
      unsub = onMessage(messaging, (payload) => {
        const { title, body } = payload.notification || {};
        if (title && document.visibilityState !== "visible") {
          new Notification(title, { body: body || "" });
        }
      });
    });
    return () => unsub?.();
  }, []);

  const requestPermission = async () => {
    try {
      const messaging = await messagingPromise;
      if (!messaging || !userId) return;

      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return;

      // Register the service worker and wait for it to be ready
      await navigator.serviceWorker.register("/messenger/firebase-messaging-sw.js");
      const sw = await navigator.serviceWorker.ready;
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: sw,
      });

      // Store the token in Firestore so the Cloud Function can look it up
      if (token) {
        await setDoc(doc(db, "fcmTokens", userId), {
          token,
          updatedAt: new Date(),
        });
      }
    } catch (err) {
      console.error("[FCM] error:", err);
    }
  };

  const disableNotifications = async () => {
    if (!userId) return;
    await deleteDoc(doc(db, "fcmTokens", userId));
    setPermission("denied");
  };

  return { permission, supported, requestPermission, disableNotifications };
}
