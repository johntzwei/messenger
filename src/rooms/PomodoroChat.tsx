import { useEffect, useRef, useState, useCallback } from 'react';
import { doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { useMessages } from '../useMessages';
import { useSwipeGesture } from '../useSwipeGesture';
import { isSystemMessage } from '../systemMessage';
import type { RoomProps } from './index';

// === Timer State ===
interface TimerState {
  endTime: number;   // Unix ms when timer expires
  type: 'work' | 'break';
  duration: number;  // original duration in minutes
  startedBy: string;
}

// NOTE: [thought process] Timer lives in Firestore meta so all clients share the same countdown.
// Each client runs its own setInterval to update the display, but the source of truth is the
// server-side endTime. This avoids clock drift issues between clients.
function useSharedTimer(db: RoomProps['db'], roomId: string) {
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [remaining, setRemaining] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const timerRef = doc(db, 'rooms', roomId, 'meta', 'timer');
    return onSnapshot(timerRef, (snap) => {
      if (snap.exists()) {
        setTimer(snap.data() as TimerState);
        setExpired(false);
      } else {
        setTimer(null);
        setRemaining('');
        setExpired(false);
      }
    });
  }, [db, roomId]);

  useEffect(() => {
    if (!timer) return;

    const tick = () => {
      const diff = timer.endTime - Date.now();
      if (diff <= 0) {
        setRemaining('00:00');
        setExpired(true);
        return;
      }
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setRemaining(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const start = async (type: 'work' | 'break', minutes: number, userName: string) => {
    const timerRef = doc(db, 'rooms', roomId, 'meta', 'timer');
    await setDoc(timerRef, {
      endTime: Date.now() + minutes * 60000,
      type,
      duration: minutes,
      startedBy: userName,
    });
  };

  const stop = async () => {
    const timerRef = doc(db, 'rooms', roomId, 'meta', 'timer');
    await deleteDoc(timerRef);
  };

  return { timer, remaining, expired, start, stop };
}

// NOTE: [pedagogical] Default Pomodoro technique: 25 min work, 5 min break.
// Users can override with any number of minutes.
const DEFAULT_WORK_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;

// NOTE: [thought process] During work sessions, the text input is replaced with a grid of
// productive emojis. This enforces focus — you can only send quick encouragement, not chat.
// A small command input remains so users can still @stop or @break.
const PRODUCTIVE_EMOJIS = [
  '💪', '🔥', '✅', '🧠', '📚', '💻',
  '⭐', '🚀', '👏', '☕', '🎯', '👍',
];

export default function PomodoroChat({ roomId, userId, userName, db }: RoomProps) {
  const { messages, send, sendAsSystem, error } = useMessages(db, roomId, userId, userName);
  const { timer, remaining, expired, start, stop } = useSharedTimer(db, roomId);
  const [text, setText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNearBottom = useRef(true);
  const hasAnnounced = useRef(false);

  const isWorkActive = timer?.type === 'work' && !expired;

  // NOTE: [thought process] Progress bar width is derived from remaining time vs original duration.
  // This keeps the visual in sync without extra state.
  const progress = timer && !expired
    ? Math.max(0, (timer.endTime - Date.now()) / (timer.duration * 60000))
    : 0;

  // === Scrolling ===
  useEffect(() => {
    if (isNearBottom.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleScroll = () => {
    const el = messagesRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    isNearBottom.current = atBottom;
    setShowScrollBtn(!atBottom);
  };

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

  const dismissKeyboard = useCallback(() => (document.activeElement as HTMLElement)?.blur(), []);
  useSwipeGesture(messagesRef, 'down', 50, dismissKeyboard);

  // === Timer Expiry Announcement ===
  useEffect(() => {
    if (expired && !hasAnnounced.current && timer) {
      hasAnnounced.current = true;
      const label = timer.type === 'work' ? 'Work' : 'Break';
      sendAsSystem('Pomodoro', `${label} session complete! (${timer.duration}m)`);
    }
  }, [expired]);

  useEffect(() => {
    hasAnnounced.current = false;
  }, [timer?.endTime]);

  // === Sending ===
  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (navigator.vibrate) navigator.vibrate(10);

    const pomodoroMatch = trimmed.match(/^@pomodoro(?:\s+(\d+))?$/i);
    const breakMatch = trimmed.match(/^@break(?:\s+(\d+))?$/i);
    const stopMatch = /^@stop$/i.test(trimmed);

    if (pomodoroMatch) {
      const minutes = pomodoroMatch[1] ? parseInt(pomodoroMatch[1]) : DEFAULT_WORK_MINUTES;
      await start('work', minutes, userName);
      send(trimmed);
      sendAsSystem('Pomodoro', `${userName} started a ${minutes}m work session`);
      setText('');
      return;
    }

    if (breakMatch) {
      const minutes = breakMatch[1] ? parseInt(breakMatch[1]) : DEFAULT_BREAK_MINUTES;
      await start('break', minutes, userName);
      send(trimmed);
      sendAsSystem('Pomodoro', `${userName} started a ${minutes}m break`);
      setText('');
      return;
    }

    if (stopMatch) {
      await stop();
      send(trimmed);
      sendAsSystem('Pomodoro', `${userName} stopped the timer`);
      setText('');
      return;
    }

    // During work sessions, only allow @ commands
    if (isWorkActive && !trimmed.startsWith('@')) return;

    send(trimmed);
    setText('');
  };

  const sendEmoji = (emoji: string) => {
    if (navigator.vibrate) navigator.vibrate(10);
    send(emoji);
  };

  // === Long-press to Copy ===
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

  useEffect(() => () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // === Render ===
  const commandInput = (
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
        placeholder={isWorkActive ? '@stop, @break...' : '@pomodoro, @break, @stop, or chat...'}
      />
      <button className="chat-send" onClick={handleSend}>Send</button>
    </div>
  );

  return (
    <div className="chat">
      {/* === Timer Display === */}
      {timer && (
        <div style={{
          padding: '12px 16px',
          background: timer.type === 'work' ? '#2a1a1a' : '#1a2a1a',
          borderBottom: '1px solid #333',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: '14px',
            color: timer.type === 'work' ? '#e88' : '#8e8',
            marginBottom: '4px',
            fontWeight: 'bold',
          }}>
            {expired
              ? (timer.type === 'work' ? 'Work Complete!' : 'Break Complete!')
              : (timer.type === 'work' ? 'Working' : 'Break')}
          </div>
          <div style={{
            fontSize: '36px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: expired ? '#888' : '#fff',
          }}>
            {remaining}
          </div>
          <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
            Started by {timer.startedBy}
          </div>
          {!expired && (
            <div style={{
              marginTop: '8px',
              height: '4px',
              background: '#333',
              borderRadius: '2px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${progress * 100}%`,
                background: timer.type === 'work' ? '#e88' : '#8e8',
                borderRadius: '2px',
                transition: 'width 1s linear',
              }} />
            </div>
          )}
        </div>
      )}

      {/* === Messages === */}
      <div className="chat-messages" ref={messagesRef} onScroll={handleScroll}>
        {error && <div className="error-text" style={{ padding: '12px' }}>Error: {error}</div>}
        {!timer && messages.length === 0 && (
          <div style={{ padding: '16px', color: '#666', textAlign: 'center', fontSize: '14px' }}>
            Type <b>@pomodoro</b> to start a 25m work session,<br />
            <b>@break</b> for a 5m break, or <b>@stop</b> to cancel.<br />
            Add a number for custom duration: <b>@pomodoro 45</b>
          </div>
        )}
        {messages.map((m) => {
          const isSystem = isSystemMessage(m.senderId);
          return (
            <div key={m.id} className={`chat-row${m.senderId === userId ? ' mine' : ''}`}>
              <div className="chat-sender" style={isSystem ? { color: '#6b8e6b' } : undefined}>
                {m.senderName}
              </div>
              <div
                className={`chat-bubble${m.senderId === userId ? ' mine' : ''}${copiedId === m.id ? ' copied' : ''}`}
                style={isSystem ? { background: '#1a2e1a', color: '#8e8' } : undefined}
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

      {/* === Input === */}
      {isWorkActive ? (
        <div style={{ borderTop: '1px solid #333', background: '#1a1a1a' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '4px',
            padding: '8px 8px 4px',
          }}>
            {PRODUCTIVE_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendEmoji(emoji)}
                style={{
                  fontSize: '24px',
                  padding: '10px 0',
                  background: 'none',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
          {commandInput}
        </div>
      ) : commandInput}
    </div>
  );
}
