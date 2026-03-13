import { useEffect, useRef, useState, useCallback } from "react";
import { useMessages } from "../useMessages";
import { useSwipeGesture } from "../useSwipeGesture";
import type { RoomProps } from "./index";

// NOTE: [pedagogical] CSS transform: scaleX(-1) mirrors text horizontally.
// We apply it to each bubble so the text reads right-to-left reversed.
function mirror(text: string): string {
  return text.split('').reverse().join('');
}

export default function MirrorChat({ roomId, userId, userName, db }: RoomProps) {
  const { messages, send, error } = useMessages(db, roomId, userId, userName);
  const [text, setText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNearBottom = useRef(true);

  useEffect(() => {
    if (isNearBottom.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

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

  const handleSend = () => {
    if (!text.trim()) return;
    if (navigator.vibrate) navigator.vibrate(10);
    send(text);
    setText("");
  };

  const onBubbleTouchStart = (msgText: string, msgId: string) => {
    longPressTimer.current = setTimeout(async () => {
      try {
        await navigator.clipboard.writeText(msgText);
        if (navigator.vibrate) navigator.vibrate(10);
        setCopiedId(msgId);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setCopiedId(null), 1200);
      } catch { /* clipboard not available */ }
    }, 500);
  };

  const onBubbleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <div className="chat mirror-chat">
      <div className="chat-messages" ref={messagesRef} onScroll={handleScroll}>
        {error && <div className="error-text" style={{ padding: "12px" }}>Error: {error}</div>}
        {messages.map((m) => (
          <div key={m.id} className={`chat-row${m.senderId === userId ? " mine" : ""}`}>
            <div className="chat-sender">{mirror(m.senderName)}</div>
            <div
              className={`chat-bubble${m.senderId === userId ? " mine" : ""}${copiedId === m.id ? " copied" : ""}`}
              onTouchStart={() => onBubbleTouchStart(m.text, m.id)}
              onTouchEnd={onBubbleTouchEnd}
              onTouchCancel={onBubbleTouchEnd}
              style={{ transform: 'scaleX(-1)' }}
            >
              {m.text}
              {copiedId === m.id && <span className="copied-toast">Copied!</span>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {showScrollBtn && (
        <button className="scroll-to-bottom" onClick={scrollToBottom} aria-label="Scroll to bottom">↓</button>
      )}
      <div className="chat-input-row">
        <input className="chat-input" type="text" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} name="message" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="Type a message..." style={{ transform: 'scaleX(-1)' }} />
        <button className="chat-send" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
