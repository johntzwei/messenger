import { useEffect, useRef, useState, useCallback } from 'react';
import { useMessages } from '../useMessages';
import { useSwipeGesture } from '../useSwipeGesture';
import { isSystemMessage } from '../systemMessage';
import type { RoomProps } from './index';

// NOTE: [pedagogical] ELIZA (1966) by Joseph Weizenbaum was one of the first chatbots.
// It works by pattern-matching user input against a ranked list of keywords, each with
// decomposition patterns (regexes) and reassembly rules (templates). The illusion of
// understanding comes from reflecting the user's own words back at them.

// === Reflection Map ===
// NOTE: [thought process] Reflection swaps first-person and second-person pronouns so
// that ELIZA can parrot the user's words back grammatically. For example, "I am sad"
// becomes "you are sad" in ELIZA's response template.
const reflections: Record<string, string> = {
  'i': 'you', 'me': 'you', 'my': 'your', 'mine': 'yours', 'myself': 'yourself',
  'am': 'are', 'was': 'were',
  'you': 'i', 'your': 'my', 'yours': 'mine', 'yourself': 'myself',
  'are': 'am', 'were': 'was',
  "i'm": 'you are', "i've": 'you have', "i'll": 'you will', "i'd": 'you would',
  "you're": 'i am', "you've": 'i have', "you'll": 'i will', "you'd": 'i would',
};

function reflect(text: string): string {
  return text.split(/\s+/).map((word) => {
    const lower = word.toLowerCase();
    return reflections[lower] ?? word;
  }).join(' ');
}

// === ELIZA Rules ===
// NOTE: [thought process] Each rule has a pattern (regex) and a list of responses.
// Captured groups get reflected and substituted into the response via $1, $2, etc.
// Rules are checked in order, so more specific patterns should come first.
interface Rule {
  pattern: RegExp;
  responses: string[];
}

const rules: Rule[] = [
  {
    pattern: /\b(?:hello|hi|hey|greetings|howdy)\b/i,
    responses: [
      'Hello. How are you feeling today?',
      'Hi there. What brings you here?',
      'Greetings. Tell me what\'s on your mind.',
    ],
  },
  {
    pattern: /i need (.*)/i,
    responses: [
      'Why do you need $1?',
      'Would it really help you to get $1?',
      'Are you sure you need $1?',
    ],
  },
  {
    pattern: /why don'?t you (.*)/i,
    responses: [
      'Do you really think I don\'t $1?',
      'Perhaps eventually I will $1.',
      'Do you really want me to $1?',
    ],
  },
  {
    pattern: /why can'?t i (.*)/i,
    responses: [
      'Do you think you should be able to $1?',
      'If you could $1, what would you do?',
      'I don\'t know — why can\'t you $1?',
    ],
  },
  {
    pattern: /i can'?t (.*)/i,
    responses: [
      'How do you know you can\'t $1?',
      'Perhaps you could $1 if you tried.',
      'What would it take for you to $1?',
    ],
  },
  {
    pattern: /i (?:am|'m) (.*)/i,
    responses: [
      'Did you come to me because you are $1?',
      'How long have you been $1?',
      'How does being $1 make you feel?',
      'Do you enjoy being $1?',
    ],
  },
  {
    pattern: /are you (.*)/i,
    responses: [
      'Why does it matter whether I am $1?',
      'Would you prefer it if I were not $1?',
      'Perhaps you believe I am $1.',
    ],
  },
  {
    pattern: /what (.*)/i,
    responses: [
      'Why do you ask?',
      'How would an answer to that help you?',
      'What do you think?',
    ],
  },
  {
    pattern: /how (.*)/i,
    responses: [
      'How do you suppose?',
      'Perhaps you can answer your own question.',
      'What is it you\'re really asking?',
    ],
  },
  {
    pattern: /because (.*)/i,
    responses: [
      'Is that the real reason?',
      'What other reasons come to mind?',
      'Does that reason apply to anything else?',
      'If $1, what else must be true?',
    ],
  },
  {
    pattern: /(?:sorry|apologi[sz]e)/i,
    responses: [
      'There\'s no need to apologize.',
      'What feelings does apologizing bring up?',
      'Don\'t be sorry — tell me more.',
    ],
  },
  {
    pattern: /i think (.*)/i,
    responses: [
      'Do you doubt $1?',
      'Do you really think so?',
      'But you\'re not sure $1?',
    ],
  },
  {
    pattern: /friend(s?)(.*)/i,
    responses: [
      'Tell me more about your friends.',
      'When you think of a friend, what comes to mind?',
      'Why don\'t you tell me about a childhood friend?',
    ],
  },
  {
    pattern: /yes/i,
    responses: [
      'You seem quite sure.',
      'OK, but can you elaborate a bit?',
      'I see. Tell me more.',
    ],
  },
  {
    pattern: /no\b/i,
    responses: [
      'Why not?',
      'You are being a bit negative.',
      'Are you saying no just to be negative?',
    ],
  },
  {
    pattern: /(?:mother|father|family|parent|brother|sister|son|daughter|child)/i,
    responses: [
      'Tell me more about your family.',
      'How does that make you feel about your family?',
      'What role does your family play in your thoughts?',
      'How do your family members react to that?',
    ],
  },
  {
    pattern: /\b(?:depressed|sad|unhappy|miserable|down|lonely)\b/i,
    responses: [
      'I am sorry to hear you are feeling that way.',
      'Can you explain what makes you feel that way?',
      'I\'m here to help you explore those feelings.',
      'Do you often feel this way?',
    ],
  },
  {
    pattern: /\b(?:happy|glad|joyful|excited|great|wonderful)\b/i,
    responses: [
      'That\'s wonderful. What makes you feel this way?',
      'How does that happiness affect your daily life?',
      'I\'m glad to hear that. Can you tell me more?',
    ],
  },
  {
    pattern: /i feel (.*)/i,
    responses: [
      'Tell me more about feeling $1.',
      'Do you often feel $1?',
      'When do you usually feel $1?',
      'When you feel $1, what do you do?',
    ],
  },
  {
    pattern: /i want (.*)/i,
    responses: [
      'What would it mean to you if you got $1?',
      'Why do you want $1?',
      'What would you do if you got $1?',
      'If you got $1, then what would you do?',
    ],
  },
  {
    pattern: /(.*)\?$/,
    responses: [
      'Why do you ask that?',
      'Please consider whether you can answer your own question.',
      'Perhaps the answer lies within yourself.',
      'Why don\'t you tell me?',
    ],
  },
];

// NOTE: [thought process] Fallback responses fire when no pattern matches. These are
// the classic Rogerian therapist deflections that keep the conversation going.
const fallbacks = [
  'Please tell me more.',
  'Let\'s change focus a bit... tell me about your family.',
  'Can you elaborate on that?',
  'Why do you say that?',
  'I see. And what does that tell you?',
  'How does that make you feel?',
  'Very interesting. Please go on.',
  'I\'m not sure I understand you fully.',
];

// NOTE: [thought process] We track which response index to use per pattern so ELIZA
// cycles through responses instead of picking randomly. This matches the original
// implementation and avoids repeating the same response consecutively.
const responseCounters = new Map<number, number>();

function getElizaResponse(input: string): string {
  for (let i = 0; i < rules.length; i++) {
    const match = input.match(rules[i].pattern);
    if (!match) continue;

    const counter = responseCounters.get(i) ?? 0;
    const responses = rules[i].responses;
    const response = responses[counter % responses.length];
    responseCounters.set(i, counter + 1);

    // Substitute captured groups with reflected text
    return response.replace(/\$(\d+)/g, (_, groupIndex) => {
      const captured = match[parseInt(groupIndex)] ?? '';
      return reflect(captured.trim().replace(/[.!?]+$/, ''));
    });
  }

  // No pattern matched — use a fallback
  const fallbackCounter = responseCounters.get(-1) ?? 0;
  responseCounters.set(-1, fallbackCounter + 1);
  return fallbacks[fallbackCounter % fallbacks.length];
}

// === Component ===
const ELIZA_SENDER_ID = '__eliza__';

export default function ElizaChat({ roomId, userId, userName, db }: RoomProps) {
  const { messages, send, sendAsSystem, error } = useMessages(db, roomId, userId, userName);
  const [text, setText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNearBottom = useRef(true);
  // NOTE: [thought process] We track the last processed message ID rather than array
  // length because useMessages uses limit(50) — once there are 50+ messages, the array
  // length stays constant as old messages drop off, which would prevent detection of
  // new messages.
  const lastProcessedId = useRef<string | null>(null);
  const initialLoad = useRef(true);
  // NOTE: [thought process] We track which message ID has a pending ELIZA response so that
  // when serverTimestamp() resolution causes a second snapshot (re-running the effect), we
  // don't cancel the in-flight timer. Without this, the effect cleanup would clear the 500ms
  // delay timer before ELIZA ever responds.
  const pendingResponseForId = useRef<string | null>(null);

  // Respond to the latest user message with ELIZA
  useEffect(() => {
    if (messages.length === 0) return;
    const latest = messages[messages.length - 1];
    if (latest.id === lastProcessedId.current) return;
    lastProcessedId.current = latest.id;

    // Skip the initial load — only respond to messages sent during this session
    if (initialLoad.current) {
      initialLoad.current = false;
      return;
    }

    // Only respond to human messages, not ELIZA's own.
    // Only the sender's client generates the reply to avoid duplicates in multiplayer.
    if (latest.senderId === ELIZA_SENDER_ID) return;
    if (latest.senderId !== userId) return;

    // @clear resets ELIZA's memory and introduces a fresh instance
    if (/@clear\b/i.test(latest.text)) {
      responseCounters.clear();
      sendAsSystem('ELIZA', 'A new ELIZA has entered the room. How can I help you today?');
      return;
    }

    const response = getElizaResponse(latest.text);
    pendingResponseForId.current = latest.id;
    // NOTE: [thought process] Small delay makes ELIZA feel more conversational,
    // as if she is "thinking" about her response.
    setTimeout(() => {
      if (pendingResponseForId.current === latest.id) {
        sendAsSystem('ELIZA', response);
        pendingResponseForId.current = null;
      }
    }, 500);
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
            Hello. I am ELIZA. How can I help you today?
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
        <input className="chat-input" type="text" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} name="message" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Tell ELIZA how you feel..." />
        <button className="chat-send" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
