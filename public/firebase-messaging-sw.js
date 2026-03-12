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

// Firebase SDK automatically shows notifications for messages with a
// "notification" payload — no onBackgroundMessage handler needed.
firebase.messaging();
