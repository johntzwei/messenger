import { useState } from "react";
import { useMessages } from "../useMessages";
import MessageList from "./MessageList";
import type { RoomProps } from "./index";

export default function GeneralChat({ roomId, userId, userName, db }: RoomProps) {
  const { messages, send, error } = useMessages(db, roomId, userId, userName);
  const [text, setText] = useState("");

  const handleSend = () => { send(text); setText(""); };

  return (
    <div className="chat">
      <MessageList messages={messages} error={error} userId={userId} />
      <div className="chat-input-row">
        <input className="chat-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="Type a message..." />
        <button className="chat-send" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
