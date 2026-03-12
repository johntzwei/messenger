import { vi } from "vitest";

// Mock Firebase modules before any component imports them
vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, cb) => {
    // Simulate a logged-in user
    cb({
      uid: "test-user-id",
      displayName: "Test User",
      email: "test@example.com",
    });
    return vi.fn(); // unsubscribe
  }),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn((_q, onNext) => {
    onNext({ docs: [] });
    return vi.fn(); // unsubscribe
  }),
  addDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false })),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
}));

vi.mock("firebase/messaging", () => ({
  getMessaging: vi.fn(),
  isSupported: vi.fn(() => Promise.resolve(false)),
  getToken: vi.fn(),
  onMessage: vi.fn(() => vi.fn()),
}));
