import { useEffect, useRef, useState, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useMessages } from "../useMessages";
import { useSwipeGesture } from "../useSwipeGesture";
import type { RoomProps } from "./index";

export default function WishingWell({ roomId, userId, userName, db }: RoomProps) {
  const { messages, send, error } = useMessages(db, roomId, userId, userName);
  const [text, setText] = useState("");
  const [voters, setVoters] = useState<Record<string, true>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);

  useEffect(() => {
    return onSnapshot(doc(db, "rooms", "wishingwell", "meta", "votes"), (snap) => {
      setVoters(snap.data()?.voters || {});
    });
  }, [db]);

  useEffect(() => {
    if (isNearBottom.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const dismissKeyboard = useCallback(() => (document.activeElement as HTMLElement)?.blur(), []);
  useSwipeGesture(messagesRef, "down", 50, dismissKeyboard);

  const handleScroll = () => {
    const el = messagesRef.current;
    if (el) isNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    if (navigator.vibrate) navigator.vibrate(10);
    const trimmed = text.trim();
    send(trimmed);
    setText("");
    if (trimmed.toLowerCase() === "@wish" && !voters[userId]) {
      await setDoc(doc(db, "rooms", "wishingwell", "meta", "votes"), {
        voters: { [userId]: true },
      }, { merge: true });
    }
  };

  const voteCount = Object.keys(voters).length;

  return (
    <div className="chat">
      <div className="wishing-well-status">
        {voteCount === 0 ? "The well awaits..." : `${voteCount}/3 wishes cast`}
        {voters[userId] && " · you have wished"}
      </div>
      <div className="chat-messages" ref={messagesRef} onScroll={handleScroll}>
        {error && <div className="error-text" style={{ padding: "12px" }}>Error: {error}</div>}
        {messages.map((m) =>
          m.senderId === "well" ? (
            <div key={m.id} className="well-message">{m.text}</div>
          ) : (
            <div key={m.id} className={`chat-row${m.senderId === userId ? " mine" : ""}`}>
              <div className="chat-sender">{m.senderName}</div>
              <div className={`chat-bubble${m.senderId === userId ? " mine" : ""}`}>{m.text}</div>
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row">
        <input className="chat-input" type="text" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} name="message" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="Type @wish to make a wish..." />
        <button className="chat-send" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
