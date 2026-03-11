/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/11.8.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.8.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCSES83g4zWqbqkPYAd_MzaCHiVBalw_K0",
  authDomain: "messenger-5064b.firebaseapp.com",
  projectId: "messenger-5064b",
  storageBucket: "messenger-5064b.firebasestorage.app",
  messagingSenderId: "115388448794",
  appId: "1:115388448794:web:ac9180f8513034201c51a3",
});

const messaging = firebase.messaging();

// Handle background messages (when app is not in foreground)
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  if (title) {
    self.registration.showNotification(title, {
      body: body || "",
      icon: "/messenger/icon-192.png",
      data: payload.data,
    });
  }
});
