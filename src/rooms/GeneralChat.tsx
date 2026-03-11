import { useEffect, useRef, useState } from "react";
import { Firestore } from "firebase/firestore";
import { useMessages } from "../useMessages";

interface Props {
  roomId: string;
  userId: string;
  userName: string;
  db: Firestore;
}

// This is a room file. It has full control over what gets rendered.
// Copy this file and modify it to make your own room!

export default function GeneralChat({ roomId, userId, userName, db }: Props) {
  const { messages, send } = useMessages(db, roomId);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    send(text, userId, userName);
    setText("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              marginBottom: "12px",
              textAlign: msg.senderId === userId ? "right" : "left",
            }}
          >
            <div style={{ fontSize: "12px", color: "#888", marginBottom: "2px" }}>
              {msg.senderName}
            </div>
            <div
              style={{
                display: "inline-block",
                padding: "8px 12px",
                borderRadius: "12px",
                background: msg.senderId === userId ? "#2a6" : "#333",
                color: "#fff",
                maxWidth: "70%",
                wordBreak: "break-word",
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", padding: "12px", borderTop: "1px solid #333" }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #444",
            background: "#1a1a1a",
            color: "#fff",
            outline: "none",
          }}
        />
        <button
          onClick={handleSend}
          style={{
            marginLeft: "8px",
            padding: "10px 20px",
            borderRadius: "8px",
            border: "none",
            background: "#2a6",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
