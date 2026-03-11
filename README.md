# Johnny's Messenger

A minimal, mobile-first chat app built with React, Firebase, and GitHub Pages. Supports push notifications as a PWA.

## Features

- Google sign-in via Firebase Auth
- Real-time chat via Firestore
- Admin console for managing an allowlist of permitted users
- PWA — installable on mobile home screens
- Push notifications via Firebase Cloud Messaging (FCM)
- Dark theme, mobile-optimized UI

## Project Structure

```
src/
  main.tsx            — App entry point, auth flow, routing
  firebase.ts         — Firebase config and exports
  Home.tsx            — Room list screen
  index.css           — All styles
  useAllowlist.ts     — Hook: real-time allowlist from Firestore
  useMessages.ts      — Hook: real-time chat messages from Firestore
  useNotifications.ts — Hook: FCM permission, token storage, foreground notifications
  rooms/
    index.ts          — Room registry and RoomProps interface
    GeneralChat.tsx   — Chat room component
    AdminConsole.tsx  — Admin-only allowlist management (commands: @list, @add, @remove)
functions/
  index.js            — Cloud Function: sends push notification on new message
  package.json
public/
  manifest.json              — PWA manifest
  firebase-messaging-sw.js   — Service worker for background push notifications
```

## Setup from Scratch

### Prerequisites

- Node.js 20+
- A Google account
- Firebase CLI (`npm install -g firebase-tools`)

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a new project
2. **Enable Authentication**: go to Authentication → Sign-in method → enable **Google**
3. **Create Firestore**: go to Firestore Database → Create database → start in **test mode** (you'll lock it down with rules later)
4. **Register a Web App**: go to Project Settings (gear icon) → General → "Add app" → Web → copy the config object

### 2. Add Your Firebase Config

Replace the config in `src/firebase.ts`:

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

Also update the same config in `public/firebase-messaging-sw.js` (the service worker can't import from the app bundle).

### 3. Generate a VAPID Key (for Push Notifications)

1. In Firebase Console → Project Settings → **Cloud Messaging** tab
2. Under **Web Push certificates**, click **Generate key pair**
3. Copy the key and replace `REPLACE_WITH_YOUR_VAPID_KEY` in `src/useNotifications.ts`

### 4. Set Firestore Security Rules

In Firebase Console → Firestore → Rules, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allowlist — readable by Cloud Functions, writable by admin
    match /allowedUsers/{email} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    // Chat rooms and messages
    match /rooms/{roomId}/messages/{messageId} {
      allow read, write: if request.auth != null;
    }

    // FCM tokens — each user can only write their own
    match /fcmTokens/{userId} {
      allow read: if false;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 5. Deploy the Cloud Function (Push Notifications)

Push notifications require the **Blaze (pay-as-you-go)** plan. The free tier is generous — a small chat app will cost $0.

```sh
firebase login
firebase init functions
# Select your project
# When asked to overwrite functions/index.js, say NO

cd functions
npm install
cd ..

firebase deploy --only functions
```

### 6. Add PWA Icons

Place two PNG icons in the `public/` folder:
- `icon-192.png` (192x192)
- `icon-512.png` (512x512)

These are used when users add the app to their home screen.

### 7. Configure GitHub Pages Deployment

Update `vite.config.ts` if your repo name differs:

```ts
export default defineConfig({
  plugins: [react()],
  base: '/your-repo-name/',
})
```

Also update the manifest link in `index.html` and the service worker path in `src/useNotifications.ts` to match your base path.

### 8. Run Locally

```sh
npm install
npm run dev
```

### 9. Deploy to GitHub Pages

```sh
npm run build
# Push the dist/ folder to gh-pages branch, or configure GitHub Actions
```

## Admin Console

The admin console is accessible from the room list but restricted to the admin email defined in `src/rooms/AdminConsole.tsx`. Change this to your own email:

```ts
const ADMIN_EMAIL = "you@gmail.com";
```

Commands:
- `@list` — show all allowed users
- `@add user@gmail.com` — add a user to the allowlist
- `@remove user@gmail.com` — remove a user

When the allowlist is empty, all authenticated users can sign in.

## Push Notifications on iOS

iOS supports push notifications for PWAs starting with iOS 16.4+, but the user **must** add the app to their home screen first — push won't work from the Safari browser tab.

## Allowlist

The allowlist is stored in Firestore (collection `allowedUsers`, where each document ID is an email). Manage it through the Admin Console room in the app. If the collection is empty or inaccessible, all authenticated users are allowed in.
