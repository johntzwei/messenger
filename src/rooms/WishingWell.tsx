import { useEffect, useRef, useState, useCallback } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { useMessages } from "../useMessages";
import { useSwipeGesture } from "../useSwipeGesture";
import type { RoomProps } from "./index";

interface Voters {
  [userId: string]: true;
}

export default function WishingWell({ roomId, userId, userName, db }: RoomProps) {
  const { messages, send, error } = useMessages(db, roomId, userId, userName);
  const [text, setText] = useState("");
  const [voters, setVoters] = useState<Voters>({});
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);

  // Listen to votes document
  useEffect(() => {
    const votesRef = doc(db, "rooms", "wishingwell", "meta", "votes");
    const unsub = onSnapshot(votesRef, (snap) => {
      const data = snap.data();
      setVoters(data?.voters || {});
    });
    return unsub;
  }, [db]);

  // Auto-scroll
  useEffect(() => {
    if (isNearBottom.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Swipe down to dismiss keyboard
  const dismissKeyboard = useCallback(() => (document.activeElement as HTMLElement)?.blur(), []);
  useSwipeGesture(messagesRef, "down", 50, dismissKeyboard);

  const handleScroll = () => {
    const el = messagesRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    isNearBottom.current = atBottom;
    setShowScrollBtn(!atBottom);
  };

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  const handleSend = async () => {
    if (!text.trim()) return;
    if (navigator.vibrate) navigator.vibrate(10);

    const trimmed = text.trim();
    const isWish = trimmed.toLowerCase() === "@wish";

    send(trimmed);
    setText("");

    if (isWish) {
      if (voters[userId]) {
        // Already voted — no-op, the Well will not respond again
        return;
      }
      const votesRef = doc(db, "rooms", "wishingwell", "meta", "votes");
      await setDoc(votesRef, {
        voters: { [userId]: true },
        lastUpdated: serverTimestamp(),
      }, { merge: true });
    }
  };

  const voteCount = Object.keys(voters).length;
  const hasVoted = !!voters[userId];

  return (
    <div className="chat">
      <div className="wishing-well-status">
        {voteCount === 0
          ? "The well awaits..."
          : `${voteCount}/3 wishes cast`}
        {hasVoted && " · you have wished"}
      </div>
      <div className="chat-messages" ref={messagesRef} onScroll={handleScroll}>
        {error && <div className="error-text" style={{ padding: "12px" }}>Error: {error}</div>}
        {messages.map((m) => {
          const isWell = m.senderId === "well";
          if (isWell) {
            return (
              <div key={m.id} className="well-message">
                {m.text}
              </div>
            );
          }
          return (
            <div key={m.id} className={`chat-row${m.senderId === userId ? " mine" : ""}`}>
              <div className="chat-sender">{m.senderName}</div>
              <div className={`chat-bubble${m.senderId === userId ? " mine" : ""}`}>
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {showScrollBtn && (
        <button className="scroll-to-bottom" onClick={scrollToBottom} aria-label="Scroll to bottom">↓</button>
      )}
      <div className="chat-input-row">
        <input
          className="chat-input"
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          name="message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type @wish to make a wish..."
        />
        <button className="chat-send" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
