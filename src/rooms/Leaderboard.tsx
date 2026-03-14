import { useEffect, useRef, useState, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useMessages } from '../useMessages';
import { useNicknames } from '../useNicknames';
import { useSwipeGesture } from '../useSwipeGesture';
import { isSystemMessage } from '../systemMessage';
import type { RoomProps } from './index';

export default function Leaderboard({ roomId, userId, userName, db }: RoomProps) {
  const { messages, send, sendAsSystem, error } = useMessages(db, roomId, userId, userName);
  const { nicknames } = useNicknames(db);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  useEffect(() => {
    if (isNearBottom.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const buildLeaderboard = async () => {
    // Build UID → nickname mapping (reverse of nicknames collection)
    const uidToNick: Record<string, string> = {};
    for (const entry of nicknames) {
      for (const uid of entry.uids) {
        uidToNick[uid] = entry.nickname;
      }
    }

    // Read stats collection
    const statsSnap = await getDocs(collection(db, 'stats'));

    // Aggregate by nickname (merges multiple UIDs under same nickname)
    const nickStats: Record<string, { total: number; rooms: Record<string, number> }> = {};
    statsSnap.forEach((doc) => {
      const data = doc.data();
      const nick = uidToNick[doc.id] || doc.id.slice(0, 8);
      if (!nickStats[nick]) nickStats[nick] = { total: 0, rooms: {} };
      nickStats[nick].total += data.total || 0;
      const rooms = data.rooms || {};
      for (const [room, count] of Object.entries(rooms)) {
        nickStats[nick].rooms[room] = (nickStats[nick].rooms[room] || 0) + (count as number);
      }
    });

    // Sort by total descending
    const sorted = Object.entries(nickStats).sort((a, b) => b[1].total - a[1].total);
    if (sorted.length === 0) return 'No messages yet.';

    // Collect all room names
    const allRooms = [...new Set(sorted.flatMap(([, s]) => Object.keys(s.rooms)))].sort();

    // Build table
    const lines = ['=== Leaderboard ==='];
    for (let i = 0; i < sorted.length; i++) {
      const [nick, stats] = sorted[i];
      const roomBreakdown = allRooms
        .filter((r) => stats.rooms[r])
        .map((r) => `${r}: ${stats.rooms[r]}`)
        .join(', ');
      lines.push(`${i + 1}. @${nick} — ${stats.total} msgs (${roomBreakdown})`);
    }
    return lines.join('\n');
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    if (navigator.vibrate) navigator.vibrate(10);
    const input = text.trim();
    send(input);
    setText('');

    // Respond to @leaderboard
    if (/@leaderboard\b/i.test(input)) {
      setLoading(true);
      const leaderboardText = await buildLeaderboard();
      sendAsSystem('System', leaderboardText);
      setLoading(false);
    }
  };

  return (
    <div className="chat">
      <div className="chat-messages" ref={messagesRef} onScroll={handleScroll}>
        {error && <div className="error-text" style={{ padding: '12px' }}>Error: {error}</div>}
        {messages.map((m) => {
          const isSystem = isSystemMessage(m.senderId);
          return (
            <div key={m.id} className={`chat-row${m.senderId === userId ? ' mine' : ''}`}>
              <div className="chat-sender">{m.senderName}</div>
              <div className={`chat-bubble${m.senderId === userId ? ' mine' : ''}${isSystem ? ' system' : ''}`}
                style={isSystem ? { whiteSpace: 'pre' } : undefined}
              >
                {m.text}
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="chat-row">
            <div className="chat-sender">System</div>
            <div className="chat-bubble system">Loading...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {showScrollBtn && (
        <button className="scroll-to-bottom" onClick={scrollToBottom} aria-label="Scroll to bottom">↓</button>
      )}
      <div className="chat-input-row">
        <input className="chat-input" type="text" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} name="message" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Type @leaderboard..." />
        <button className="chat-send" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
