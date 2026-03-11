import { useEffect, useRef, useState } from "react";
import { useMessages } from "../useMessages";
import type { RoomProps } from "./index";

export default function GeneralChat({ roomId, userId, userName, db }: RoomProps) {
  const { messages, send, error } = useMessages(db, roomId);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = () => { send(text, userId, userName); setText(""); };

  return (
    <div className="chat">
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
      <div className="chat-input-row">
        <input className="chat-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="Type a message..." />
        <button className="chat-send" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
