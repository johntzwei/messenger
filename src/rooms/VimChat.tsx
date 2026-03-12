import { useRef, useState, useMemo, useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { vim, getCM, CodeMirror as CM5 } from "@replit/codemirror-vim";
import { keymap, EditorView } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { useMessages } from "../useMessages";
import MessageList from "./MessageList";
import type { RoomProps } from "./index";

const darkTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#000 !important",
      color: "#0f0 !important",
      fontSize: "16px",
    },
    ".cm-content": {
      caretColor: "#0f0",
      color: "#0f0 !important",
      padding: "10px 14px",
      fontFamily: "monospace",
      minHeight: "auto",
    },
    ".cm-line": {
      color: "#0f0 !important",
    },
    ".cm-placeholder": {
      color: "#0a0 !important",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#0f0",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: "rgba(0,255,0,0.2) !important",
    },
    ".cm-gutters": { display: "none" },
    ".cm-activeLineGutter": { display: "none" },
    ".cm-activeLine": { backgroundColor: "transparent" },
  },
  { dark: true }
);

export default function VimChat({ roomId, userId, userName, db }: RoomProps) {
  const { messages, send, error } = useMessages(db, roomId, userId, userName);
  const [vimMode, setVimMode] = useState("NORMAL");
  const editorViewRef = useRef<EditorView | null>(null);
  const sendRef = useRef(send);
  sendRef.current = send;

  const handleSend = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return;
    const text = view.state.doc.toString();
    if (!text.trim()) return;
    sendRef.current(text);
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: "" },
    });
    const cm = getCM(view);
    if (cm?.state?.vim) {
      cm.state.vim.insertMode = false;
      cm.state.vim.visualMode = false;
      CM5.signal(cm, "vim-mode-change", { mode: "normal" });
    }
    setVimMode("NORMAL");
    view.focus();
  }, []);

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
    [handleSend]
  );

  const extensions = useMemo(
    () => [vim(), sendKeymap, darkTheme],
    [sendKeymap]
  );

  const onCreateEditor = useCallback((view: EditorView) => {
    editorViewRef.current = view;
    const cm = getCM(view);
    if (cm) {
      cm.on("vim-mode-change", (e: { mode: string; subMode?: string }) => {
        setVimMode(e.mode.toUpperCase());
      });
    }
  }, []);

  const modeClass =
    vimMode === "INSERT"
      ? "insert"
      : vimMode === "VISUAL"
        ? "visual"
        : "";

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  return (
    <div className="chat vim-chat">
      <MessageList messages={messages} error={error} userId={userId} />
      {isMobile ? (
        <div className="vim-disabled-notice">Vim mode is desktop only</div>
      ) : (
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
      )}
    </div>
  );
}
