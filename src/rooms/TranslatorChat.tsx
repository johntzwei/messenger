import { useEffect, useRef, useState, useCallback } from 'react';
import { useMessages } from '../useMessages';
import { useSwipeGesture } from '../useSwipeGesture';
import type { RoomProps } from './index';

// NOTE: [thought process] The translate endpoint keeps the Anthropic API key server-side.
// Each user sets a prompt on entry that defines how their messages get transformed.
// The prompt lives in local state so it resets every time you join the room.
const TRANSLATE_URL = 'https://us-central1-messenger-5064b.cloudfunctions.net/translateMessage';

export default function TranslatorChat({ roomId, userId, userName, db }: RoomProps) {
  const { messages, send, error } = useMessages(db, roomId, userId, userName);
  const [text, setText] = useState('');
  const [prompt, setPrompt] = useState('');
  const [promptDraft, setPromptDraft] = useState('');
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

    // NOTE: [thought process] Translate before sending so the message that appears in chat
    // is the transformed version. If translation fails, fall back to the original text.
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

  // === Prompt Setup Screen ===
  if (!prompt) {
    return (
      <div className="chat" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '16px' }}>
        <div style={{ fontSize: '24px' }}>🌐</div>
        <div style={{ textAlign: 'center', color: '#ccc', fontSize: '14px', maxWidth: '300px' }}>
          Set your translation prompt. All your messages will be transformed through it.
        </div>
        <input
          className="chat-input"
          type="text"
          autoComplete="off"
          value={promptDraft}
          onChange={(e) => setPromptDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && promptDraft.trim() && setPrompt(promptDraft.trim())}
          placeholder='e.g. "translate as if I was a sloppy spaghetti"'
          style={{ width: '100%', maxWidth: '320px' }}
        />
        <button
          className="chat-send"
          onClick={() => promptDraft.trim() && setPrompt(promptDraft.trim())}
          style={{ padding: '8px 24px' }}
        >
          Set Prompt
        </button>
      </div>
    );
  }

  // === Chat Screen ===
  return (
    <div className="chat">
      <div style={{ padding: '6px 12px', fontSize: '11px', color: '#888', background: '#1a1a1a', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          Prompt: {prompt}
        </span>
        <button
          onClick={() => { setPrompt(''); setPromptDraft(''); }}
          style={{ background: 'none', border: 'none', color: '#888', fontSize: '11px', cursor: 'pointer', marginLeft: '8px', whiteSpace: 'nowrap' }}
        >
          change
        </button>
      </div>
      <div className="chat-messages" ref={messagesRef} onScroll={handleScroll}>
        {error && <div className="error-text" style={{ padding: '12px' }}>Error: {error}</div>}
        {messages.map((m) => (
          <div key={m.id} className={`chat-row${m.senderId === userId ? ' mine' : ''}`}>
            <div className="chat-sender">{m.senderName}</div>
            <div
              className={`chat-bubble${m.senderId === userId ? ' mine' : ''}${copiedId === m.id ? ' copied' : ''}`}
              onTouchStart={() => onBubbleTouchStart(m.text, m.id)}
              onTouchEnd={onBubbleTouchEnd}
              onTouchCancel={onBubbleTouchEnd}
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
          placeholder={translating ? 'Translating...' : 'Type a message...'}
          disabled={translating}
        />
        <button className="chat-send" onClick={handleSend} disabled={translating}>
          {translating ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
