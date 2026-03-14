import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  Timestamp,
  Firestore,
} from 'firebase/firestore';

export interface GuestPass {
  email: string;
  expiresAt: Date;
}

// Real-time listener on the "guestPasses" collection.
// Each document ID is an email address, with an expiresAt timestamp.
export function useGuestPasses(db: Firestore) {
  const [passes, setPasses] = useState<GuestPass[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'guestPasses'),
      (snap) => {
        setPasses(snap.docs.map((d) => {
          const raw = d.data().expiresAt;
          // NOTE: [edge case callout] Documents written via the admin API POST
          // store expiresAt as a plain {_seconds, _nanoseconds} object rather
          // than a native Firestore Timestamp. Handle both formats.
          const expiresAt = raw?.toDate
            ? (raw as Timestamp).toDate()
            : new Date((raw?._seconds ?? 0) * 1000);
          return { email: d.id, expiresAt };
        }));
        setLoading(false);
      },
      () => { setLoading(false); },
    );
    return unsub;
  }, [db]);

  // NOTE: [thought process] We check expiry client-side so the admin can see
  // expired passes in the list (marked as such). Expired docs could be cleaned
  // up by a scheduled function later if needed.
  const validEmails = passes
    .filter((p) => p.expiresAt > new Date())
    .map((p) => p.email);

  const grant = async (email: string, hours = 24) => {
    const expiresAt = Timestamp.fromDate(
      new Date(Date.now() + hours * 60 * 60 * 1000)
    );
    await setDoc(doc(db, 'guestPasses', email.toLowerCase()), { expiresAt });
  };

  const revoke = async (email: string) => {
    await deleteDoc(doc(db, 'guestPasses', email.toLowerCase()));
  };

  return { passes, validEmails, loading, grant, revoke };
}
