import { useEffect, useRef, useState, useCallback } from 'react';
import { useMessages } from '../useMessages';
import { useSwipeGesture } from '../useSwipeGesture';
import { isSystemMessage } from '../systemMessage';
import type { RoomProps } from './index';

// NOTE: [thought process] Alice speaks unprompted via a Cloud Function that calls Claude.
// The client sets a random timer (15-30s) and pings the function, which handles the
// message count cap server-side to avoid races between multiple clients.

const ALICE_SENDER_ID = '__alice__';
const ALICE_SPEAK_URL = 'https://us-central1-messenger-5064b.cloudfunctions.net/aliceSpeak';

export default function AliceChat({ roomId, userId, userName, db }: RoomProps) {
  const { messages, send, error } = useMessages(db, roomId, userId, userName);
  const [text, setText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [aliceDone, setAliceDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNearBottom = useRef(true);

  // NOTE: [thought process] The server enforces a 5s cooldown between Alice messages,
  // so the client just pings on a fixed interval. Multiple clients hitting the endpoint
  // won't make Alice speak faster than the server allows.
  useEffect(() => {
    if (aliceDone) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(ALICE_SPEAK_URL);
        const data = await res.json();
        if (data.reason === 'limit reached') setAliceDone(true);
      } catch { /* network error — try again next cycle */ }
    }, 8000);
    return () => clearInterval(interval);
  }, [aliceDone]);

  useEffect(() => {
    if (isNearBottom.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const dismissKeyboard = useCallback(() => (document.activeElement as HTMLElement)?.blur(), []);
  useSwipeGesture(messagesRef, 'down', 50, dismissKeyboard);

  const handleScroll = () => {
    const el = messagesRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    isNearBottom.current = atBottom;
    setShowScrollBtn(!atBottom);
  };

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

  const handleSend = () => {
    if (!text.trim()) return;
    if (navigator.vibrate) navigator.vibrate(10);
    send(text);
    setText('');
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
    <div className="chat">
      <div className="chat-messages" ref={messagesRef} onScroll={handleScroll}>
        {error && <div className="error-text" style={{ padding: '12px' }}>Error: {error}</div>}
        {messages.length === 0 && !aliceDone && (
          <div style={{ padding: '16px', textAlign: 'center', color: '#888', fontStyle: 'italic' }}>
            Alice is somewhere in Wonderland...
          </div>
        )}
        {messages.map((m) => {
          const isAlice = m.senderId === ALICE_SENDER_ID;
          const isSystem = isSystemMessage(m.senderId);
          const isMine = m.senderId === userId;
          return (
            <div key={m.id} className={`chat-row${isMine ? ' mine' : ''}`}>
              <div className="chat-sender" style={isAlice ? { color: '#9b59b6' } : isSystem ? { color: '#6b8e6b' } : undefined}>
                {m.senderName}
              </div>
              <div
                className={`chat-bubble${isMine ? ' mine' : ''}${isSystem ? ' system' : ''}${copiedId === m.id ? ' copied' : ''}`}
                onTouchStart={() => onBubbleTouchStart(m.text, m.id)}
                onTouchEnd={onBubbleTouchEnd}
                onTouchCancel={onBubbleTouchEnd}
              >
                {m.text}
                {copiedId === m.id && <span className="copied-toast">Copied!</span>}
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
        <input className="chat-input" type="text" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} name="message" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Say something to Alice..." />
        <button className="chat-send" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
