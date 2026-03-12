import { useEffect, useRef, useState, useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { vim, getCM, CodeMirror as CM5 } from "@replit/codemirror-vim";
import { keymap, EditorView } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { useMessages } from "../useMessages";
import type { RoomProps } from "./index";

const darkTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#1a1a1a",
      color: "#fff",
      fontSize: "16px",
    },
    ".cm-content": {
      caretColor: "#2a6",
      padding: "10px 14px",
      fontFamily: "monospace",
      minHeight: "auto",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#2a6",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: "rgba(42,170,102,0.3) !important",
    },
    ".cm-gutters": { display: "none" },
    ".cm-activeLineGutter": { display: "none" },
    ".cm-activeLine": { backgroundColor: "transparent" },
  },
  { dark: true }
);

export default function VimChat({ roomId, userId, userName, db }: RoomProps) {
  const { messages, send, error } = useMessages(db, roomId);
  const [vimMode, setVimMode] = useState("NORMAL");
  const bottomRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const view = editorViewRef.current;
    if (!view) return;
    const text = view.state.doc.toString();
    if (!text.trim()) return;
    send(text, userId, userName);
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: "" },
    });
    // Reset to normal mode
    const cm = getCM(view);
    if (cm?.state?.vim) {
      cm.state.vim.insertMode = false;
      cm.state.vim.visualMode = false;
      CM5.signal(cm, "vim-mode-change", { mode: "normal" });
    }
    setVimMode("NORMAL");
    view.focus();
  };

  const sendKeymap = useMemo(
    () =>
      Prec.highest(
        keymap.of([
          {
            key: "Enter",
            run: () => {
              handleSend();
              return true;
            },
          },
        ])
      ),
    // handleSend captures refs so this is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const extensions = useMemo(
    () => [vim(), sendKeymap, darkTheme],
    [sendKeymap]
  );

  const onCreateEditor = (view: EditorView) => {
    editorViewRef.current = view;
    const cm = getCM(view);
    if (cm) {
      cm.on("vim-mode-change", (e: { mode: string; subMode?: string }) => {
        setVimMode(e.mode.toUpperCase());
      });
    }
  };

  const modeClass =
    vimMode === "INSERT"
      ? "insert"
      : vimMode === "VISUAL"
        ? "visual"
        : "";

  return (
    <div className="chat">
      <div className="chat-messages">
        {error && <div className="error-text" style={{ padding: "12px" }}>Error: {error}</div>}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`chat-row${m.senderId === userId ? " mine" : ""}`}
          >
            <div className="chat-sender">{m.senderName}</div>
            <div
              className={`chat-bubble${m.senderId === userId ? " mine" : ""}`}
            >
              {m.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row vim-input-row">
        <span className={`vim-mode-badge ${modeClass}`}>{vimMode}</span>
        <div className="vim-editor-wrapper">
          <CodeMirror
            value=""
            extensions={extensions}
            onCreateEditor={onCreateEditor}
            basicSetup={false}
            placeholder="Press i to type..."
          />
        </div>
        <button className="chat-send" onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  );
}
