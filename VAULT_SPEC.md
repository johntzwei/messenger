# Vault — Secure Hackable Chat Platform

## Project Spec

### Overview

Vault is a secure, real-time chat platform hosted as a static site on GitHub Pages, backed by Firebase. It functions as a mini messaging platform where any authenticated user can create rooms, invite others, and chat. The key differentiator is that rooms are extensible — users can vibe-code custom widgets and functionality on top of a secure chat foundation.

The app should be built as a Progressive Web App (PWA) so it can be installed on mobile home screens and behave like a native app.

---

### Architecture

- **Frontend**: Static site (HTML/CSS/JS or React) hosted on GitHub Pages
- **Backend**: Firebase (no custom server code except Cloud Functions for push notifications)
  - **Auth**: Firebase Auth with Google sign-in (OAuth 2.0)
  - **Database**: Cloud Firestore for real-time message syncing, room metadata, user profiles, and widget state
  - **Push**: Firebase Cloud Messaging (FCM) + a Cloud Function that triggers on new messages
- **Security model**: Firebase security rules (not E2E encrypted). Data encrypted in transit (TLS) and at rest (AES-256) by Firebase. Security rules enforce that only authenticated room members can read/write room data.

---

### Core Features

#### Authentication
- Google sign-in via Firebase Auth
- Session persists across visits (Firebase SDK handles token storage via IndexedDB)
- No cookies needed — Firebase manages auth state client-side
- User profile stored in Firestore: `users/{uid}` with display name, photo URL, email

#### Rooms
- Any authenticated user can create a room
- Rooms support 1-on-1 and group chat (up to ~10 people)
- Users can invite others by sharing a link or by entering their email
- Each room has: name, member list, created timestamp, optional description/theme
- Home screen shows a list of rooms the user belongs to, sorted by most recent activity
- Firestore structure:
  ```
  rooms/{roomId}
    - name: string
    - members: string[] (UIDs)
    - createdBy: string (UID)
    - createdAt: timestamp
    - lastMessageAt: timestamp
    - description: string (optional)
    - theme: string (optional)

  rooms/{roomId}/messages/{messageId}
    - text: string
    - senderId: string (UID)
    - senderName: string
    - timestamp: timestamp
  ```

#### Messaging
- Real-time message delivery via Firestore onSnapshot listeners
- Messages displayed in chronological order with sender name and timestamp
- Auto-scroll to newest message
- Offline support: messages queue locally and sync when connection is restored (Firestore handles this automatically)
- Paginate message history (load last 50, then load more on scroll up)

#### Push Notifications
- Implemented as a PWA with a service worker
- Firebase Cloud Messaging for push delivery
- A Firebase Cloud Function watches `rooms/{roomId}/messages` for new documents and sends a push notification to all other room members
- Notification content: "New message from [sender name]" (sender name is not encrypted, acceptable tradeoff)
- On iOS, requires user to "Add to Home Screen" for push to work

#### PWA Setup
- `manifest.json` with app name, icons, theme color, `display: standalone`
- Service worker for:
  - Caching static assets for offline use
  - Handling push notification events
  - Showing notification banners when app is in background
- When added to home screen: opens full-screen, has its own icon, feels native

---

### Widget / Extensibility System

This is the long-term differentiator. Rooms should be built on a clean, extensible architecture so that custom widgets can be added.

#### How Widgets Work
- A widget is a self-contained UI component that can read/write to a Firestore subcollection under the room: `rooms/{roomId}/widgets/{widgetId}/data/{docId}`
- Widgets have both local state (React state / JS variables) and shared state (synced via Firestore)
- Widgets can also listen to the room's message stream (read-only) to react to chat messages

#### Widget Examples (for inspiration, not required at launch)
- **Poll**: Members create polls, others vote, results update in real-time
- **Shared timer**: Pomodoro or countdown synced across all members
- **Shared to-do list**: Collaborative task list for the room
- **Dice roller**: For tabletop RPG groups
- **Link collector**: Shared bookmarks with tags
- **Music queue**: Members add YouTube/Spotify links, vote on what plays next

#### Implementation Approach
- Start simple: build the core chat with a clean component architecture
- Each room should have a designated area (sidebar, bottom panel, or modal) where widgets render
- Widgets are JS/React components that follow a defined interface:
  ```
  interface Widget {
    id: string;
    name: string;
    component: React.FC<{ roomId: string; userId: string; db: Firestore }>;
  }
  ```
- For v1, widgets are bundled with the app (added to the codebase)
- Future: runtime-loaded widgets via sandboxed iframes for security

---

### Firebase Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // User profiles
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }

    // Rooms
    match /rooms/{roomId} {
      allow read: if request.auth != null && request.auth.uid in resource.data.members;
      allow create: if request.auth != null;
      allow update: if request.auth != null && request.auth.uid in resource.data.members;

      // Messages within a room
      match /messages/{messageId} {
        allow read: if request.auth != null && request.auth.uid in get(/databases/$(database)/documents/rooms/$(roomId)).data.members;
        allow create: if request.auth != null && request.auth.uid in get(/databases/$(database)/documents/rooms/$(roomId)).data.members;
      }

      // Widget data within a room
      match /widgets/{widgetId}/data/{docId} {
        allow read, write: if request.auth != null && request.auth.uid in get(/databases/$(database)/documents/rooms/$(roomId)).data.members;
      }
    }
  }
}
```

---

### UI / Design Direction

- Dark theme, minimal, slightly techy aesthetic
- Clean typography — monospace for metadata (timestamps, room IDs), sans-serif for messages
- Subtle accent color (e.g., muted green or teal) for interactive elements
- Screens:
  1. **Login**: Logo, tagline, "Sign in with Google" button
  2. **Home / Room List**: List of rooms with last message preview, unread indicator, "Create Room" button
  3. **Chat**: Message list, input area, room header with name and member count, widget area
  4. **Room Settings**: Member list, invite controls, room name/description editing
- Mobile-first responsive design
- Animations: subtle message entrance, smooth screen transitions

---

### Tech Stack

- **Framework**: React (or vanilla JS if simpler for GitHub Pages deployment — your call)
- **Build**: Vite for local dev, build output goes to GitHub Pages
- **Firebase SDK**: v10+ (modular imports preferred for tree-shaking)
- **Hosting**: GitHub Pages (static build output)
- **Cloud Functions**: Node.js, deployed via Firebase CLI (separate from GitHub Pages)

---

### Deployment

1. Static frontend builds to a `/dist` or `/docs` folder
2. Push to GitHub, GitHub Pages serves the static files
3. Firebase project handles auth, database, and push (configured via Firebase console)
4. Cloud Function for push notifications deployed separately via `firebase deploy --only functions`
5. Custom domain optional (GitHub Pages supports it)

---

### Firebase Setup Required

Before running the app, you need to:
1. Create a Firebase project at console.firebase.google.com
2. Enable Google sign-in in Firebase Auth
3. Create a Firestore database
4. Register a web app and get the config object (apiKey, authDomain, projectId, etc.)
5. Deploy security rules
6. (For push) Set up Firebase Cloud Messaging and deploy the Cloud Function

The Firebase config should be stored in an environment variable or config file that gets injected at build time. It is NOT secret (Firebase API keys are meant to be public — security is enforced by Firestore rules, not key secrecy).

---

### Migration Notes

- Firebase is a convenient starting point but the app is not tightly coupled to it
- Google sign-in uses standard OAuth 2.0 — works with any auth provider
- Firestore data is exportable as JSON
- Easiest migration target: Supabase (open-source Firebase alternative, Postgres-based, similar real-time API)
- Alternative: PocketBase (single binary, SQLite, self-hosted)

---

### Out of Scope for v1

- End-to-end encryption (Firebase security is sufficient for this use case)
- Runtime-loaded widgets (v1 bundles widgets in the codebase; sandboxed iframes are a v2 feature)
- Moderation tools (not needed at small friend-group scale)
- File/image sharing (can be added later via Firebase Storage)
- Read receipts, typing indicators (nice-to-have, not essential)
- Message editing/deletion (can be added later)

---

### Summary

Build a PWA chat platform on GitHub Pages + Firebase. Google sign-in, real-time Firestore messaging, push notifications via Cloud Functions, and a widget architecture that lets users extend room functionality. Dark minimal UI, mobile-first. Keep the codebase clean and extensible — this is meant to be a foundation that people can vibe-code on top of.
