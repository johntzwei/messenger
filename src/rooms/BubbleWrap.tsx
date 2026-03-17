import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useMessages } from "../useMessages";
import type { Message } from "../useMessages";
import { isSystemMessage } from "../systemMessage";
import type { RoomProps } from "./index";

// === Collapse Logic ===
interface CollapsedGroup {
  ids: string[];
  senderName: string;
  senderId: string;
  popperName: string;
  keys: string[];
}

type DisplayItem = { type: "message"; message: Message } | { type: "group"; group: CollapsedGroup };

const POP_RE = /^(.+) popped (.+)$/;

function collapseMessages(messages: Message[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  let currentGroup: CollapsedGroup | null = null;

  for (const m of messages) {
    if (isSystemMessage(m.senderId)) {
      const match = POP_RE.exec(m.text);
      if (match) {
        const [, popperName, keysStr] = match;
        // NOTE: [thought process] Batched messages send "Q, W, E" as a single message.
        // Splitting on ", " handles both old single-key messages and new batched ones.
        const keys = keysStr.split(', ');
        if (currentGroup && currentGroup.popperName === popperName) {
          currentGroup.ids.push(m.id);
          currentGroup.keys.push(...keys);
        } else {
          if (currentGroup) items.push({ type: "group", group: currentGroup });
          currentGroup = { ids: [m.id], senderName: m.senderName, senderId: m.senderId, popperName, keys };
        }
        continue;
      }
    }
    // Non-pop message breaks the group
    if (currentGroup) { items.push({ type: "group", group: currentGroup }); currentGroup = null; }
    items.push({ type: "message", message: m });
  }
  if (currentGroup) items.push({ type: "group", group: currentGroup });
  return items;
}

// === Keyboard Layout ===
const ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
];

const BATCH_INTERVAL = 4000;

// Display label for special keys
function keyLabel(key: string) {
  if (key === '⎵') return '';
  if (key === '⏎') return '⏎';
  return key;
}

export default function BubbleWrap({ roomId, userId, userName, db }: RoomProps) {
  const { messages, sendAsSystem, error } = useMessages(db, roomId, userId, userName);
  const [popped, setPopped] = useState<Set<string>>(new Set());
  const [batch, setBatch] = useState<string[]>([]);
  const [batchPulse, setBatchPulse] = useState(0);
  const batchRef = useRef<string[]>([]);
  const batchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Clean up timers on unmount
  useEffect(() => () => {
    timers.current.forEach((t) => clearTimeout(t));
    if (batchTimer.current) clearTimeout(batchTimer.current);
  }, []);

  const flushBatch = useCallback(() => {
    if (batchRef.current.length === 0) return;
    const keys = batchRef.current;
    sendAsSystem('Bubble Wrap', `${userName} popped ${keys.join(', ')}`, '__bubblewrap__');
    batchRef.current = [];
    setBatch([]);
    batchTimer.current = null;
  }, [userName, sendAsSystem]);

  const popBubble = useCallback((key: string) => {
    if (popped.has(key)) return;

    if (navigator.vibrate) navigator.vibrate(15);

    setPopped((prev) => new Set(prev).add(key));

    // Add to batch
    batchRef.current.push(key);
    setBatch([...batchRef.current]);
    setBatchPulse((p) => p + 1);

    // Start or reset the batch timer
    if (batchTimer.current) clearTimeout(batchTimer.current);
    batchTimer.current = setTimeout(flushBatch, BATCH_INTERVAL);

    // Reinflate after 1 second
    const timer = setTimeout(() => {
      setPopped((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      timers.current.delete(key);
    }, 1000);
    timers.current.set(key, timer);
  }, [popped, flushBatch]);

  const displayItems = useMemo(() => collapseMessages(messages), [messages]);

  return (
    <div className="chat bubblewrap-chat">
      <div className="chat-messages">
        {error && <div className="error-text" style={{ padding: '12px' }}>Error: {error}</div>}
        {displayItems.map((item) => {
          if (item.type === 'group') {
            const g = item.group;
            return (
              <div key={g.ids[0]} className="chat-row">
                <div className="chat-sender">{g.senderName}</div>
                <div className="chat-bubble system bw-collapsed">
                  <span className="bw-popper">{g.popperName} popped</span>
                  <span className="bw-keys">
                    {g.keys.map((k, i) => (
                      <span key={g.ids[0] + '-' + i} className="bw-key-bubble">{keyLabel(k)}</span>
                    ))}
                  </span>
                </div>
              </div>
            );
          }
          const m = item.message;
          return (
            <div key={m.id} className={`chat-row${isSystemMessage(m.senderId) ? '' : m.senderId === userId ? ' mine' : ''}`}>
              <div className="chat-sender">{m.senderName}</div>
              <div className={`chat-bubble${isSystemMessage(m.senderId) ? ' system' : m.senderId === userId ? ' mine' : ''}`}>
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Pending batch indicator */}
      {batch.length > 0 && (
        <div className="bw-batch-bar" key={batchPulse}>
          <span className="bw-batch-label">popping:</span>
          <span className="bw-batch-keys">
            {batch.map((k, i) => (
              <span key={i} className="bw-batch-key">{keyLabel(k)}</span>
            ))}
          </span>
        </div>
      )}

      <div className="bubblewrap-grid">
        {ROWS.map((row, ri) => (
          <div key={ri} className="bubblewrap-row" style={{ paddingLeft: ri === 1 ? '5%' : ri === 2 ? '12%' : 0 }}>
            {row.map((key) => (
              <button
                key={key}
                className={`bubblewrap-bubble${popped.has(key) ? ' popped' : ''}`}
                onPointerDown={() => popBubble(key)}
                aria-label={`Pop bubble ${key}`}
              >
                {key}
              </button>
            ))}
          </div>
        ))}
        {/* Space and newline row */}
        <div className="bubblewrap-row">
          <button
            className={`bubblewrap-bubble bw-newline${popped.has('⏎') ? ' popped' : ''}`}
            onPointerDown={() => popBubble('⏎')}
            aria-label="Pop bubble newline"
          >
            ⏎
          </button>
          <button
            className={`bubblewrap-bubble bw-space${popped.has('⎵') ? ' popped' : ''}`}
            onPointerDown={() => popBubble('⎵')}
            aria-label="Pop bubble space"
          >
          </button>
        </div>
      </div>
    </div>
  );
}
