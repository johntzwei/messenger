import { useEffect, useRef, useState, useCallback } from 'react';
import { useMessages } from '../useMessages';
import { useSwipeGesture } from '../useSwipeGesture';
import type { RoomProps } from './index';

// NOTE: [thought process] Users set their translation prompt by sending a message starting
// with @translate. That message is visible to everyone in chat, and from then on all the
// user's subsequent messages get transformed through Claude before posting. Sending a new
// @translate message changes the prompt. The prompt resets when you leave the room since
// it's just local state.
const TRANSLATE_URL = 'https://us-central1-messenger-5064b.cloudfunctions.net/translateMessage';
const TRANSLATE_PREFIX = '@translate ';

export default function TranslatorChat({ roomId, userId, userName, db }: RoomProps) {
  const { messages, send, error } = useMessages(db, roomId, userId, userName);
  const [text, setText] = useState('');
  const [prompt, setPrompt] = useState('');
  const [translating, setTranslating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNearBottom = useRef(true);

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

  const handleSend = async () => {
    const original = text.trim();
    if (!original || translating) return;
    if (navigator.vibrate) navigator.vibrate(10);
    setText('');

    // NOTE: [thought process] @translate messages set the prompt and are sent as-is so
    // everyone can see what translation style each person picked. Regular messages get
    // translated if the user has a prompt set, otherwise sent raw.
    if (original.toLowerCase().startsWith(TRANSLATE_PREFIX)) {
      const newPrompt = original.slice(TRANSLATE_PREFIX.length).trim();
      if (newPrompt) setPrompt(newPrompt);
      send(original);
      return;
    }

    // No prompt set — block regular messages
    if (!prompt) return;

    setTranslating(true);
    try {
      const res = await fetch(TRANSLATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: original, prompt }),
      });
      const data = await res.json();
      send(data.translated || original);
    } catch {
      send(original);
    } finally {
      setTranslating(false);
    }
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

  // NOTE: [thought process] Highlight @translate messages with a distinct color so they
  // stand out as prompt-setting commands rather than regular conversation.
  const isTranslateMsg = (msgText: string) =>
    msgText.toLowerCase().startsWith(TRANSLATE_PREFIX);

  return (
    <div className="chat">
      {prompt && (
        <div style={{ padding: '6px 12px', fontSize: '11px', color: '#888', background: '#1a1a1a', borderBottom: '1px solid #333' }}>
          Your prompt: {prompt}
        </div>
      )}
      <div className="chat-messages" ref={messagesRef} onScroll={handleScroll}>
        {error && <div className="error-text" style={{ padding: '12px' }}>Error: {error}</div>}
        {messages.length === 0 && (
          <div style={{ padding: '16px', textAlign: 'center', color: '#888', fontStyle: 'italic' }}>
            Send <b style={{ color: '#9b59b6' }}>@translate my words to ___</b> to set your style.
          </div>
        )}
        {messages.map((m) => {
          const isMine = m.senderId === userId;
          const isPromptMsg = isTranslateMsg(m.text);
          return (
            <div key={m.id} className={`chat-row${isMine ? ' mine' : ''}`}>
              <div className="chat-sender" style={isPromptMsg ? { color: '#9b59b6' } : undefined}>
                {m.senderName}
              </div>
              <div
                className={`chat-bubble${isMine ? ' mine' : ''}${copiedId === m.id ? ' copied' : ''}`}
                style={isPromptMsg ? { fontStyle: 'italic', opacity: 0.8 } : undefined}
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
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={translating ? 'Translating...' : prompt ? 'Type a message...' : '@translate my words to...'}
          disabled={translating}
        />
        <button className="chat-send" onClick={handleSend} disabled={translating}>
          {translating ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
