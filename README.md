# Johnny's Messenger

Minimal mobile-first chat app with hackable chatrooms. React + Firebase + GitHub Pages.

## Adding a Chatroom

Every chatroom is a single React component in `src/rooms/`. Adding one takes two steps.

### Step 1: Create `src/rooms/YourRoom.tsx`

Your component receives `RoomProps` and can do whatever it wants with the UI. Here's the minimal version:

```tsx
import { useState } from 'react';
import { useMessages } from '../useMessages';
import MessageList from './MessageList';
import type { RoomProps } from './index';

export default function YourRoom({ roomId, userId, userName, db }: RoomProps) {
  const { messages, send, error } = useMessages(db, roomId, userId, userName);
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim()) return;
    send(text);
    setText('');
  };

  return (
    <div className="chat">
      <MessageList messages={messages} error={error} userId={userId} />
      <div className="chat-input-row">
        <input
          className="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
        />
        <button className="chat-send" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
```

### Step 2: Register in `src/rooms/index.ts`

Import your component and add an entry to the `rooms` object:

```ts
import YourRoom from './YourRoom';

const rooms: Record<string, { name: string; component: ComponentType<RoomProps> }> = {
  // ...existing rooms...
  yourroom: { name: 'Your Room', component: YourRoom },
};
```

That's it. The home screen and routing pick it up automatically.

### Firestore Rules

New rooms generally don't need rule changes. The existing rules in `firestore.rules` already allow any authenticated user to read/write:

- `rooms/{roomId}/messages/{messageId}` — chat messages (all rooms share this wildcard)
- `rooms/{roomId}/meta/{docId}` — per-room metadata (e.g. WishingWell uses this for vote state)

If your room stores data in a **new top-level collection** (not under `rooms/`), you'll need to add a rule for it in `firestore.rules` and deploy with:

```sh
npx firebase-tools deploy --only firestore:rules --project messenger-5064b
```

### Step 3 (optional): Add CSS

All styles live in `src/index.css`. Scope room-specific styles with a class on the root div (e.g. `<div className="chat yourroom-chat">` and `.yourroom-chat .your-element { ... }`).

## Available Building Blocks

### `useMessages(db, roomId, userId, userName)`

The core hook (`src/useMessages.ts`). Returns:

- `messages` — array of `{ id, text, senderId, senderName, timestamp }`, last 50, real-time
- `send(text)` — send a message as the current user
- `sendAsSystem(name, text, id?)` — send a message as a system/bot sender (uses `__name__` convention for sender ID)
- `error` — error string or null

### `MessageList`

Drop-in component (`src/rooms/MessageList.tsx`) for standard chat display with auto-scroll. Takes `{ messages, error, userId }`. Use this for standard chat UI; skip it if you're building something custom (like Bubble Wrap does).

### `isSystemMessage(senderId)`

Helper (`src/systemMessage.ts`). Returns true if the sender ID follows the `__name__` convention (e.g. `__eliza__`). Use this to style bot/system messages differently.

### `RoomProps`

```ts
interface RoomProps {
  roomId: string;   // the key from the rooms registry
  userId: string;   // Firebase Auth UID
  userName: string;  // display name
  userEmail: string; // email address
  db: Firestore;    // Firestore instance
}
```

## Examples to Copy From

- **Standard chat**: `src/rooms/GeneralChat.tsx` — full-featured with scroll-to-bottom, long-press copy, swipe gestures
- **Minimal twist on chat**: `src/rooms/MirrorChat.tsx` — same as General but mirrors text with CSS transform
- **Custom (non-chat) UI**: `src/rooms/BubbleWrap.tsx` — keyboard-layout bubble popping, batched system messages, custom rendering
- **Bot/NPC chat**: `src/rooms/ElizaChat.tsx` — responds to user messages with automated replies via `sendAsSystem`

## Key Files

| File | Purpose |
|------|---------|
| `src/rooms/index.ts` | Room registry — add new rooms here |
| `src/rooms/MessageList.tsx` | Reusable message list component |
| `src/useMessages.ts` | Real-time chat messages hook (Firestore) |
| `src/systemMessage.ts` | `isSystemMessage()` helper |
| `src/main.tsx` | App shell, auth, routing |
| `src/index.css` | All styles |
| `src/firebase.ts` | Firebase config |
| `functions/index.js` | Cloud Functions: push notifications + admin API |
| `firestore.rules` | Firestore security rules |

## Stack

- **Frontend**: React 19, TypeScript, Vite, deployed to GitHub Pages at `/messenger/`
- **Backend**: Firebase (Firestore, Auth, Cloud Messaging)
- **Cloud Functions**: `functions/index.js` (Node.js 20) — push notifications + admin API
- **Firestore rules**: `firestore.rules`

## Setup from Scratch

### Prerequisites

- Node.js 20+
- A Google account
- Firebase CLI (`npm install -g firebase-tools`)

### 1. Create a Firebase Project

1. Go to the Firebase Console and create a new project
2. **Enable Authentication**: go to Authentication > Sign-in method > enable **Google**
3. **Create Firestore**: go to Firestore Database > Create database > start in **test mode** (you'll lock it down with rules later)
4. **Register a Web App**: go to Project Settings (gear icon) > General > "Add app" > Web > copy the config object

### 2. Add Your Firebase Config

Replace the config in `src/firebase.ts` and also in `public/firebase-messaging-sw.js` (the service worker can't import from the app bundle).

### 3. Generate a VAPID Key (for Push Notifications)

1. In Firebase Console > Project Settings > **Cloud Messaging** tab
2. Under **Web Push certificates**, click **Generate key pair**
3. Copy the key and replace `REPLACE_WITH_YOUR_VAPID_KEY` in `src/useNotifications.ts`

### 4. Deploy Firestore Security Rules

```sh
npx firebase-tools deploy --only firestore:rules --project <your-project-id>
```

### 5. Deploy Cloud Functions (Push Notifications)

Push notifications require the **Blaze (pay-as-you-go)** plan. The free tier is generous — a small chat app will cost $0.

```sh
cd functions && npm install && cd ..
npx firebase-tools deploy --only functions --project <your-project-id>
```

### 6. Run Locally

```sh
npm install
npm run dev
```

### 7. Deploy to GitHub Pages

Update `vite.config.ts` if your repo name differs, then:

```sh
npm run build
# Push to main — GitHub Actions auto-deploys
```

## Deploying

```sh
# Frontend (auto-deploys via GitHub Actions on push to main)
npm run build

# Cloud Functions
npx firebase-tools deploy --only functions --project messenger-5064b

# Firestore rules
npx firebase-tools deploy --only firestore:rules --project messenger-5064b
```

## Debugging

### Common Issues

- **Blank screen on iOS**: `Notification` API doesn't exist on iOS Safari outside PWA. Guard all access with `typeof Notification !== 'undefined'`.
- **Duplicate notifications**: `serverTimestamp()` can cause Firestore to fire document-created events twice. The cloud function deduplicates using an in-memory Set.
- **Permission denied on Firestore writes**: Check that the collection has a matching rule in `firestore.rules`. Deploy with `npx firebase-tools deploy --only firestore:rules`.
- **Messages stop loading/sending**: Likely hit Firestore free tier quota (50K reads/day). Check by querying the admin API — if Firestore responds, the quota isn't the issue.

### Admin API

Query Firestore directly (bypasses security rules):

```sh
# Get the admin key
npx firebase-tools functions:secrets:access ADMIN_KEY --project messenger-5064b

# Status overview
curl -s "https://us-central1-messenger-5064b.cloudfunctions.net/adminQuery?key=<KEY>" | python3 -m json.tool

# Query a collection
curl -s "https://us-central1-messenger-5064b.cloudfunctions.net/adminQuery?key=<KEY>&collection=rooms/general/messages&limit=5&orderBy=timestamp&order=desc" | python3 -m json.tool
```

### Cloud Function Logs

```sh
npx firebase-tools functions:log --project messenger-5064b 2>&1 | tail -20
```

## Admin Console

Accessible from the room list, restricted to the admin email in `src/rooms/AdminConsole.tsx`. Commands: `@list`, `@add user@gmail.com`, `@remove user@gmail.com`. When the allowlist is empty, all authenticated users can sign in.

## Push Notifications on iOS

iOS supports push for PWAs starting with iOS 16.4+, but the user **must** add the app to their home screen first — push won't work from the Safari browser tab.