# Johnny's Messenger

A simple, secure chat app built with React and Firebase.

## Setup

### Prerequisites

- Node.js
- A Firebase project

### Firebase Setup

1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. Enable **Authentication** and turn on the **Google** sign-in provider.
3. Create a **Firestore Database**.
4. Register a **Web app** in your project settings and copy the Firebase config object.
5. Replace the config in `src/firebase.ts` with your own:

```ts
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
};
```

### Allowlist

Edit `src/allowlist.ts` to control who can sign in. Add Gmail addresses to the array:

```ts
export const ALLOWED_EMAILS = [
  "you@gmail.com",
  "friend@gmail.com",
];
```

### Run Locally

```sh
npm install
npm run dev
```
