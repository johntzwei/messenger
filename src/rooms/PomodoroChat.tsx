import { useEffect, useRef, useState, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useMessages } from "../useMessages";
import { useSwipeGesture } from "../useSwipeGesture";
import type { RoomProps } from "./index";

interface TimerState {
  startTime: number;       // epoch ms when timer was started
  focusMinutes: number;
  breakMinutes: number;
  paused: boolean;
  pausedElapsed: number;   // elapsed ms when paused
  startedBy: string;       // who started/last acted
}

const DEFAULT_FOCUS = 25;
const DEFAULT_BREAK = 5;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getPhase(timer: TimerState | null, now: number): { phase: "focus" | "break" | "stopped"; remaining: number; cycle: number } {
  if (!timer || timer.paused) {
    if (timer?.pausedElapsed != null && timer.pausedElapsed > 0) {
      const cycleMs = (timer.focusMinutes + timer.breakMinutes) * 60 * 1000;
      const pos = timer.pausedElapsed % cycleMs;
      const focusMs = timer.focusMinutes * 60 * 1000;
      const cycle = Math.floor(timer.pausedElapsed / cycleMs) + 1;
      if (pos < focusMs) {
        return { phase: "focus", remaining: Math.ceil((focusMs - pos) / 1000), cycle };
      } else {
        return { phase: "break", remaining: Math.ceil((cycleMs - pos) / 1000), cycle };
      }
    }
    return { phase: "stopped", remaining: 0, cycle: 0 };
  }

  const elapsed = now - timer.startTime;
  const cycleMs = (timer.focusMinutes + timer.breakMinutes) * 60 * 1000;
  const pos = elapsed % cycleMs;
  const focusMs = timer.focusMinutes * 60 * 1000;
  const cycle = Math.floor(elapsed / cycleMs) + 1;

  if (pos < focusMs) {
    return { phase: "focus", remaining: Math.ceil((focusMs - pos) / 1000), cycle };
  } else {
    return { phase: "break", remaining: Math.ceil((cycleMs - pos) / 1000), cycle };
  }
}

export default function PomodoroChat({ roomId, userId, userName, db }: RoomProps) {
  const { messages, send, sendAsSystem, error } = useMessages(db, roomId, userId, userName);
  const [text, setText] = useState("");
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPhaseRef = useRef<string | null>(null);

  const timerDoc = doc(db, "rooms", roomId, "meta", "timer");

  // Listen to timer state
  useEffect(() => {
    return onSnapshot(timerDoc, (snap) => {
      setTimer(snap.exists() ? (snap.data() as TimerState) : null);
    });
  }, [db, roomId]);

  // Tick every second when timer is running
  useEffect(() => {
    if (timer && !timer.paused) {
      const interval = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(interval);
    }
  }, [timer?.paused, timer?.startTime]);

  // Auto-scroll
  useEffect(() => {
    if (isNearBottom.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Clean up timers on unmount
  useEffect(() => () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // Swipe down to dismiss keyboard
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

  // Timer commands
  const updateTimer = (state: Partial<TimerState>) =>
    setDoc(timerDoc, state, { merge: true });

  const handleTimerCommand = async (args: string) => {
    const cmd = args.trim().toLowerCase();

    if (cmd === "start" || cmd === "") {
      if (timer?.paused && timer.pausedElapsed > 0) {
        // Resume from paused position
        const resumeStart = Date.now() - timer.pausedElapsed;
        await updateTimer({ startTime: resumeStart, paused: false, pausedElapsed: 0, startedBy: userName });
        sendAsSystem("Timer", `${userName} resumed the timer`);
      } else {
        // Fresh start
        await updateTimer({
          startTime: Date.now(),
          focusMinutes: timer?.focusMinutes ?? DEFAULT_FOCUS,
          breakMinutes: timer?.breakMinutes ?? DEFAULT_BREAK,
          paused: false,
          pausedElapsed: 0,
          startedBy: userName,
        });
        sendAsSystem("Timer", `${userName} started the timer (${timer?.focusMinutes ?? DEFAULT_FOCUS}/${timer?.breakMinutes ?? DEFAULT_BREAK})`);
      }
    } else if (cmd === "pause" || cmd === "stop") {
      if (timer && !timer.paused) {
        const elapsed = Date.now() - timer.startTime;
        await updateTimer({ paused: true, pausedElapsed: elapsed });
        sendAsSystem("Timer", `${userName} paused the timer`);
      }
    } else if (cmd === "reset") {
      await setDoc(timerDoc, {
        startTime: 0,
        focusMinutes: timer?.focusMinutes ?? DEFAULT_FOCUS,
        breakMinutes: timer?.breakMinutes ?? DEFAULT_BREAK,
        paused: true,
        pausedElapsed: 0,
        startedBy: userName,
      });
      sendAsSystem("Timer", `${userName} reset the timer`);
    } else if (cmd.startsWith("set ")) {
      const match = cmd.match(/^set\s+(\d+)\s*\/\s*(\d+)$/);
      if (match) {
        const focus = Math.max(1, Math.min(120, parseInt(match[1])));
        const brk = Math.max(1, Math.min(30, parseInt(match[2])));
        await updateTimer({ focusMinutes: focus, breakMinutes: brk });
        sendAsSystem("Timer", `${userName} set timer to ${focus}/${brk}`);
      } else {
        sendAsSystem("Timer", `Usage: @timer set 25/5`);
      }
    } else if (cmd === "status") {
      const { phase, remaining, cycle } = getPhase(timer, Date.now());
      if (phase === "stopped") {
        sendAsSystem("Timer", `Timer is stopped. Type @timer start to begin.`);
      } else {
        const pauseNote = timer?.paused ? " (paused)" : "";
        sendAsSystem("Timer", `Cycle ${cycle} · ${phase} · ${formatTime(remaining)} left${pauseNote}`);
      }
    } else if (cmd === "help") {
      sendAsSystem("Timer", `Commands:\n@timer start — start or resume\n@timer pause — pause\n@timer reset — reset to 0\n@timer set 25/5 — set focus/break\n@timer status — show status`);
    } else {
      sendAsSystem("Timer", `Unknown command. Type @timer help for usage.`);
    }
  };

  const handleSend = () => {
    if (!text.trim()) return;
    if (navigator.vibrate) navigator.vibrate(10);
    const trimmed = text.trim();
    send(trimmed);
    setText("");

    // Check for @timer command
    const timerMatch = trimmed.match(/^@timer\s*(.*)/i);
    if (timerMatch) {
      handleTimerCommand(timerMatch[1]);
    }
  };

  // Long-press to copy
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

  const { phase, remaining, cycle } = getPhase(timer, now);
  const isRunning = timer != null && !timer.paused;

  return (
    <div className="chat pomodoro-chat">
      <div className={`pomo-timer-bar ${phase}`}>
        {phase === "stopped" ? (
          <span className="pomo-status">Timer stopped · type <b>@timer start</b></span>
        ) : (
          <>
            <span className="pomo-phase">{phase === "focus" ? "Focus" : "Break"}</span>
            <span className="pomo-time">{formatTime(remaining)}</span>
            <span className="pomo-cycle">#{cycle}</span>
            {timer?.paused && <span className="pomo-paused">paused</span>}
          </>
        )}
      </div>
      <div className="chat-messages" ref={messagesRef} onScroll={handleScroll}>
        {error && <div className="error-text" style={{ padding: "12px" }}>Error: {error}</div>}
        {messages.map((m) => {
          const isSystem = m.senderId.startsWith("__") && m.senderId.endsWith("__");
          return (
            <div key={m.id} className={`chat-row${m.senderId === userId ? " mine" : ""}${isSystem ? " system" : ""}`}>
              <div className="chat-sender">{m.senderName}</div>
              <div
                className={`chat-bubble${m.senderId === userId ? " mine" : ""}${isSystem ? " system" : ""}${copiedId === m.id ? " copied" : ""}`}
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
        <input className="chat-input" type="text" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} name="message" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="Chat or @timer start/pause/reset..." />
        <button className="chat-send" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
