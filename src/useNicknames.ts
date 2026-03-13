import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  Firestore,
} from 'firebase/firestore';

export interface NicknameEntry {
  nickname: string;
  uids: string[];
}

// Real-time listener on the 'nicknames' collection.
// Each document ID is a nickname, with a `uids` array field.
export function useNicknames(db: Firestore) {
  const [nicknames, setNicknames] = useState<NicknameEntry[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'nicknames'),
      (snap) => {
        setNicknames(snap.docs.map((d) => ({
          nickname: d.id,
          uids: d.data().uids || [],
        })));
      },
    );
    return unsub;
  }, [db]);

  const set = async (nickname: string, uids: string[]) => {
    await setDoc(doc(db, 'nicknames', nickname.toLowerCase()), { uids });
  };

  const remove = async (nickname: string) => {
    await deleteDoc(doc(db, 'nicknames', nickname.toLowerCase()));
  };

  return { nicknames, set, remove };
}
