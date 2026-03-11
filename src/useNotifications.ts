import { useEffect, useState } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { doc, setDoc, deleteDoc, Firestore } from "firebase/firestore";
import { messagingPromise } from "./firebase";

// VAPID key — you generate this in Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
// Replace this placeholder after generating yours
const VAPID_KEY = "REPLACE_WITH_YOUR_VAPID_KEY";

export function useNotifications(db: Firestore, userId: string | null) {
  const [permission, setPermission] = useState(Notification.permission);
  const [supported, setSupported] = useState(true);

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
    const messaging = await messagingPromise;
    if (!messaging || !userId) return;

    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") return;

    // Register the service worker and get the FCM token
    const sw = await navigator.serviceWorker.register("/messenger/firebase-messaging-sw.js");
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
  };

  const disableNotifications = async () => {
    if (!userId) return;
    await deleteDoc(doc(db, "fcmTokens", userId));
    setPermission("denied");
  };

  return { permission, supported, requestPermission, disableNotifications };
}
