import { useEffect, useRef, useState, useCallback } from 'react';
import { useMessages } from '../useMessages';
import { useSwipeGesture } from '../useSwipeGesture';
import { isSystemMessage } from '../systemMessage';
import { ElizaPlusEngine } from './elizaPlusEngine';
import type { RoomProps } from './index';

// NOTE: [thought process] The engine is instantiated once per component mount via useRef.
// This keeps all state (thread, memory, counters) alive for the session but resets on
// page reload, which is the desired behavior for a stateful chatbot.

const ELIZA_SENDER_ID = '__eliza++__';

export default function ElizaPlusChat({ roomId, userId, userName, db }: RoomProps) {
  const { messages, send, sendAsSystem, error } = useMessages(db, roomId, userId, userName);
  const [text, setText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNearBottom = useRef(true);
  const lastProcessedId = useRef<string | null>(null);
  const initialLoad = useRef(true);
  const pendingResponseForId = useRef<string | null>(null);
  const engineRef = useRef(new ElizaPlusEngine());

  // Respond to the latest user message with ELIZA++
  useEffect(() => {
    if (messages.length === 0) return;
    const latest = messages[messages.length - 1];
    if (latest.id === lastProcessedId.current) return;
    lastProcessedId.current = latest.id;

    if (initialLoad.current) {
      initialLoad.current = false;
      return;
    }

    if (latest.senderId === ELIZA_SENDER_ID) return;
    if (latest.senderId !== userId) return;

    // @clear resets the engine
    if (/@clear\b/i.test(latest.text)) {
      engineRef.current.reset();
      sendAsSystem('ELIZA++', 'A fresh ELIZA++ is here. I was made by Claude to be a good listener. How can I help you today?', ELIZA_SENDER_ID);
      return;
    }

    const response = engineRef.current.respond(latest.text);
    pendingResponseForId.current = latest.id;
    setTimeout(() => {
      if (pendingResponseForId.current === latest.id) {
        sendAsSystem('ELIZA++', response, ELIZA_SENDER_ID);
        pendingResponseForId.current = null;
      }
    }, 600);
  }, [messages]);

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
        {messages.length === 0 && (
          <div style={{ padding: '16px', textAlign: 'center', color: '#888', fontStyle: 'italic' }}>
            Hello! I'm ELIZA++, made by Claude to be a kind and attentive listener. Tell me what's on your mind.
          </div>
        )}
        {messages.map((m) => {
          const isSystem = isSystemMessage(m.senderId);
          const isMine = m.senderId === userId;
          return (
            <div key={m.id} className={`chat-row${isMine ? ' mine' : ''}`}>
              <div className="chat-sender" style={isSystem ? { color: '#6b8e6b' } : undefined}>
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
        <input className="chat-input" type="text" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} name="message" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Tell ELIZA++ how you feel..." />
        <button className="chat-send" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
