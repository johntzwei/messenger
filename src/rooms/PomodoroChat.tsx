import { useState, useEffect, useRef, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useMessages } from "../useMessages";
import { useSwipeGesture } from "../useSwipeGesture";
import type { RoomProps } from "./index";

const PRESETS = [
  { label: "Work", minutes: 25 },
  { label: "Short Break", minutes: 5 },
  { label: "Long Break", minutes: 15 },
];

interface TimerState {
  duration: number;       // total seconds
  remaining: number;      // seconds remaining when last updated
  running: boolean;
  updatedAt: number;      // Date.now() when state was written
  startedBy: string;      // display name
  label: string;          // "Work", "Short Break", etc.
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function PomodoroChat({ roomId, userId, userName, db }: RoomProps) {
  const { messages, send, sendAsSystem, error } = useMessages(db, roomId, userId, userName);
  const [text, setText] = useState("");
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [display, setDisplay] = useState(0);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);
  const animRef = useRef<number>(0);


  // Listen to shared timer state
  useEffect(() => {
    const ref = doc(db, "rooms", roomId, "meta", "timer");
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setTimer(snap.data() as TimerState);
      } else {
        setTimer(null);
      }
    });
  }, [db, roomId]);

  // Tick the display countdown locally
  useEffect(() => {
    const tick = () => {
      if (timer) {
        if (timer.running) {
          const elapsed = Math.floor((Date.now() - timer.updatedAt) / 1000);
          const rem = Math.max(0, timer.remaining - elapsed);
          setDisplay(rem);
          // Auto-complete when hitting zero
          if (rem === 0 && timer.remaining > 0) {
            handleComplete();
          }
        } else {
          setDisplay(timer.remaining);
        }
      } else {
        setDisplay(0);
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [timer]);

  // Announce timer completed via system message (only one client fires)
  const handleComplete = useCallback(async () => {
    const ref = doc(db, "rooms", roomId, "meta", "timer");
    // Stop the timer at 0
    await setDoc(ref, {
      duration: timer?.duration ?? 0,
      remaining: 0,
      running: false,
      updatedAt: Date.now(),
      startedBy: timer?.startedBy ?? "",
      label: timer?.label ?? "",
    });
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    sendAsSystem("pomodoro", `${timer?.label ?? "Timer"} complete! Time's up.`);
  }, [timer, db, roomId, sendAsSystem]);

  // Start a preset timer
  const startTimer = async (preset: typeof PRESETS[number]) => {
    const ref = doc(db, "rooms", roomId, "meta", "timer");
    const secs = preset.minutes * 60;
    await setDoc(ref, {
      duration: secs,
      remaining: secs,
      running: true,
      updatedAt: Date.now(),
      startedBy: userName,
      label: preset.label,
    });
    if (navigator.vibrate) navigator.vibrate(10);
    sendAsSystem("pomodoro", `${userName} started a ${preset.minutes}min ${preset.label} timer.`);
  };

  const pauseTimer = async () => {
    if (!timer) return;
    const ref = doc(db, "rooms", roomId, "meta", "timer");
    const elapsed = Math.floor((Date.now() - timer.updatedAt) / 1000);
    const rem = Math.max(0, timer.remaining - elapsed);
    await setDoc(ref, { ...timer, remaining: rem, running: false, updatedAt: Date.now() });
    sendAsSystem("pomodoro", `${userName} paused the timer at ${formatTime(rem)}.`);
  };

  const resumeTimer = async () => {
    if (!timer || timer.remaining <= 0) return;
    const ref = doc(db, "rooms", roomId, "meta", "timer");
    await setDoc(ref, { ...timer, running: true, updatedAt: Date.now() });
    sendAsSystem("pomodoro", `${userName} resumed the timer.`);
  };

  const resetTimer = async () => {
    if (!timer) return;
    const ref = doc(db, "rooms", roomId, "meta", "timer");
    await setDoc(ref, { ...timer, remaining: timer.duration, running: false, updatedAt: Date.now() });
    sendAsSystem("pomodoro", `${userName} reset the timer.`);
  };

  // Chat scroll logic
  useEffect(() => {
    if (isNearBottom.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  // Progress for ring (0 = full, 1 = done)
  const progress = timer && timer.duration > 0 ? 1 - display / timer.duration : 0;
  const isRunning = timer?.running ?? false;
  const isComplete = timer != null && timer.remaining > 0 === false && timer.duration > 0;
  const hasTimer = timer != null && timer.duration > 0;

  // SVG ring parameters
  const size = 160;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="chat pomodoro-chat">
      {/* Timer display */}
      <div className="pomo-timer-area">
        <div className="pomo-ring-container">
          <svg width={size} height={size} className="pomo-ring">
            <circle
              cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke="#333" strokeWidth={stroke}
            />
            <circle
              cx={size / 2} cy={size / 2} r={radius}
              fill="none"
              stroke={isComplete ? "#f55" : isRunning ? "#2a6" : "#666"}
              strokeWidth={stroke}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: "stroke-dashoffset 0.3s linear" }}
            />
          </svg>
          <div className="pomo-time-display">
            <div className="pomo-time">{formatTime(display)}</div>
            {timer?.label && <div className="pomo-label">{timer.label}</div>}
            {timer?.startedBy && <div className="pomo-started-by">by {timer.startedBy}</div>}
          </div>
        </div>

        {/* Controls */}
        <div className="pomo-controls">
          {!hasTimer || isComplete ? (
            // Show presets when no timer or timer complete
            <div className="pomo-presets">
              {PRESETS.map((p) => (
                <button key={p.label} className="pomo-preset-btn" onClick={() => startTimer(p)}>
                  {p.label} ({p.minutes}m)
                </button>
              ))}
            </div>
          ) : (
            // Show pause/resume/reset when timer active
            <div className="pomo-actions">
              {isRunning ? (
                <button className="pomo-action-btn pause" onClick={pauseTimer}>Pause</button>
              ) : (
                <button className="pomo-action-btn resume" onClick={resumeTimer}>Resume</button>
              )}
              <button className="pomo-action-btn reset" onClick={resetTimer}>Reset</button>
            </div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="chat-messages" ref={messagesRef} onScroll={handleScroll}>
        {error && <div className="error-text" style={{ padding: "12px" }}>Error: {error}</div>}
        {messages.map((m) => {
          const isSystem = m.senderId === "__pomodoro__";
          return (
            <div key={m.id} className={`chat-row${m.senderId === userId ? " mine" : ""}`}>
              <div className="chat-sender">{m.senderName}</div>
              <div className={`chat-bubble${m.senderId === userId ? " mine" : ""}${isSystem ? " system" : ""}`}>
                {m.text}
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
          type="text" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
          name="message" value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Chat while you focus..."
        />
        <button className="chat-send" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
