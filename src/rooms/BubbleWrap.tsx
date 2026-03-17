import { useEffect, useRef, useState, useCallback } from "react";
import { useMessages } from "../useMessages";
import { isSystemMessage } from "../systemMessage";
import type { RoomProps } from "./index";

// Keyboard-style bubble layout
const ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
];

export default function BubbleWrap({ roomId, userId, userName, db }: RoomProps) {
  const { messages, sendAsSystem, error } = useMessages(db, roomId, userId, userName);
  const [popped, setPopped] = useState<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Clean up timers on unmount
  useEffect(() => () => {
    timers.current.forEach((t) => clearTimeout(t));
  }, []);

  const popBubble = useCallback((key: string) => {
    if (popped.has(key)) return; // already popped

    if (navigator.vibrate) navigator.vibrate(15);

    setPopped((prev) => new Set(prev).add(key));
    sendAsSystem("Bubble Wrap", `${userName} popped ${key}`, "__bubblewrap__");

    // Reinflate after 1 second
    const timer = setTimeout(() => {
      setPopped((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      timers.current.delete(key);
    }, 1000);
    timers.current.set(key, timer);
  }, [popped, userName, sendAsSystem]);

  return (
    <div className="chat bubblewrap-chat">
      <div className="chat-messages" ref={messagesRef}>
        {error && <div className="error-text" style={{ padding: "12px" }}>Error: {error}</div>}
        {messages.map((m) => (
          <div key={m.id} className={`chat-row${isSystemMessage(m.senderId) ? "" : m.senderId === userId ? " mine" : ""}`}>
            <div className="chat-sender">{m.senderName}</div>
            <div className={`chat-bubble${isSystemMessage(m.senderId) ? " system" : m.senderId === userId ? " mine" : ""}`}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="bubblewrap-grid">
        {ROWS.map((row, ri) => (
          <div key={ri} className="bubblewrap-row" style={{ paddingLeft: ri === 1 ? "5%" : ri === 2 ? "12%" : 0 }}>
            {row.map((key) => (
              <button
                key={key}
                className={`bubblewrap-bubble${popped.has(key) ? " popped" : ""}`}
                onPointerDown={() => popBubble(key)}
                aria-label={`Pop bubble ${key}`}
              >
                {key}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
