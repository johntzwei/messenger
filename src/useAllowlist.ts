import { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  Firestore,
} from "firebase/firestore";

// Real-time listener on the "allowedUsers" collection.
// Each document ID is an email address.
export function useAllowlist(db: Firestore) {
  const [emails, setEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "allowedUsers"), (snap) => {
      setEmails(snap.docs.map((d) => d.id));
      setLoading(false);
    });
    return unsub;
  }, [db]);

  const add = async (email: string) => {
    await setDoc(doc(db, "allowedUsers", email.toLowerCase()), {});
  };

  const remove = async (email: string) => {
    await deleteDoc(doc(db, "allowedUsers", email.toLowerCase()));
  };

  return { emails, loading, add, remove };
}
