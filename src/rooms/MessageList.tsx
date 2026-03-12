import { useEffect, useRef } from "react";
import type { Message } from "../useMessages";

export default function MessageList({ messages, error, userId }: { messages: Message[]; error: string | null; userId: string }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="chat-messages">
      {error && <div className="error-text" style={{ padding: "12px" }}>Error: {error}</div>}
      {messages.map((m) => (
        <div key={m.id} className={`chat-row${m.senderId === userId ? " mine" : ""}`}>
          <div className="chat-sender">{m.senderName}</div>
          <div className={`chat-bubble${m.senderId === userId ? " mine" : ""}`}>{m.text}</div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
