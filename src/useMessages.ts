import { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  serverTimestamp,
  Firestore,
} from "firebase/firestore";

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: any;
}

// Listen to the last 50 messages in a room
export function useMessages(db: Firestore, roomId: string) {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "rooms", roomId, "messages"),
      orderBy("timestamp", "asc"),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Message)));
    });

    return unsub;
  }, [db, roomId]);

  // Send a message
  const send = async (text: string, userId: string, userName: string) => {
    if (!text.trim()) return;
    await addDoc(collection(db, "rooms", roomId, "messages"), {
      text: text.trim(),
      senderId: userId,
      senderName: userName,
      timestamp: serverTimestamp(),
    });
  };

  return { messages, send };
}
