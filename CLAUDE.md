# Claude Code Guide

## Project

Minimal mobile-first chat app: React + Firebase + GitHub Pages.

## Stack

- **Frontend**: React 19, TypeScript, Vite, deployed to GitHub Pages at `/messenger/`
- **Backend**: Firebase (Firestore, Auth, Cloud Messaging)
- **Cloud Functions**: Node.js 20, deployed via `npx firebase-tools deploy --only functions --project messenger-5064b`
- **Firestore rules**: `firestore.rules`, deployed via `npx firebase-tools deploy --only firestore:rules --project messenger-5064b`

## Debugging

### Admin API (query Firestore directly)

The `adminQuery` Cloud Function bypasses security rules. The key is stored as a Firebase secret (`ADMIN_KEY`).

Retrieve the key:
```sh
npx firebase-tools functions:secrets:access ADMIN_KEY --project messenger-5064b
```

Status overview (allowlist + FCM tokens):
```sh
curl -s "https://us-central1-messenger-5064b.cloudfunctions.net/adminQuery?key=<KEY>" | python3 -m json.tool
```

Query a specific collection:
```sh
curl -s "https://us-central1-messenger-5064b.cloudfunctions.net/adminQuery?key=<KEY>&collection=rooms/general/messages&limit=5&orderBy=timestamp&order=desc" | python3 -m json.tool
```

### Cloud Function logs

```sh
npx firebase-tools functions:log --project messenger-5064b 2>&1 | tail -20
```

### Auth users

```sh
npx firebase-tools auth:export /dev/stdout --format=json --project messenger-5064b
```

### Common issues

- **Blank screen on iOS**: `Notification` API doesn't exist on iOS Safari outside PWA. Guard all access with `typeof Notification !== "undefined"`.
- **"No active Service Worker" error**: Must wait for service worker to activate before calling `getToken`. Use `navigator.serviceWorker.ready`.
- **Duplicate notifications**: `serverTimestamp()` can cause Firestore to fire document-created events twice. The function deduplicates using an in-memory Set.
- **Messages stop loading/sending**: Likely hit Firestore free tier quota (50K reads or 20K writes/day). The `exists()` check in security rules doubles reads — avoid it. Check by querying the admin API; if Firestore responds, the quota isn't the issue.
- **Permission denied on Firestore writes**: Check that the collection has a matching rule in `firestore.rules`. Deploy rules with `npx firebase-tools deploy --only firestore:rules`.

### Deploying

```sh
# Frontend (auto-deploys via GitHub Actions on push to main)
npm run build

# Cloud Functions
npx firebase-tools deploy --only functions --project messenger-5064b

# Firestore rules only
npx firebase-tools deploy --only firestore:rules --project messenger-5064b
```

### Key files

- `src/firebase.ts` — Firebase config
- `src/useNotifications.ts` — FCM client: permission, token registration, foreground messages
- `src/useMessages.ts` — Real-time chat messages (Firestore listener)
- `src/useAllowlist.ts` — Allowlist hook
- `src/main.tsx` — App shell, auth, routing
- `public/firebase-messaging-sw.js` — Service worker for background push notifications
- `functions/index.js` — Cloud Functions: push notifications + admin API
- `firestore.rules` — Firestore security rules
- `firebase.json` — Firebase project config
