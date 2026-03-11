import { useEffect, useRef, useState } from "react";
import { Firestore } from "firebase/firestore";
import { useMessages } from "../useMessages";
import { ALLOWED_EMAILS } from "../allowlist";

const ADMIN_EMAIL = "johntzwei@gmail.com";

interface Props {
  roomId: string;
  userId: string;
  userName: string;
  userEmail: string;
  db: Firestore;
}

interface LogEntry {
  id: string;
  text: string;
  type: "command" | "response" | "error";
}

function processCommand(input: string): LogEntry[] {
  const trimmed = input.trim();
  if (!trimmed.startsWith("@")) {
    return [{ id: crypto.randomUUID(), text: "Commands must start with @. Try @help", type: "error" }];
  }

  const [cmd, ...args] = trimmed.slice(1).split(/\s+/);

  switch (cmd.toLowerCase()) {
    case "help":
      return [
        {
          id: crypto.randomUUID(),
          type: "response",
          text: [
            "Available commands:",
            "",
            "  @list              — Show all allowed users",
            "  @add <email>       — Add a user to the allowlist",
            "  @remove <email>    — Remove a user from the allowlist",
            "  @rules             — Show Firestore security rules to paste in Firebase Console",
            "  @help              — Show this help message",
          ].join("\n"),
        },
      ];

    case "list":
      return [
        {
          id: crypto.randomUUID(),
          type: "response",
          text: ALLOWED_EMAILS.length
            ? "Allowed users:\n\n" + ALLOWED_EMAILS.map((e, i) => `  ${i + 1}. ${e}`).join("\n")
            : "Allowlist is empty (all users permitted).",
        },
      ];

    case "add": {
      const email = args[0]?.toLowerCase();
      if (!email || !email.includes("@")) {
        return [{ id: crypto.randomUUID(), type: "error", text: "Usage: @add <email>" }];
      }
      if (ALLOWED_EMAILS.includes(email)) {
        return [{ id: crypto.randomUUID(), type: "response", text: `${email} is already on the list.` }];
      }
      ALLOWED_EMAILS.push(email);
      return [
        {
          id: crypto.randomUUID(),
          type: "response",
          text: `Added ${email}.\n\nNote: This change is temporary (in-memory only). To make it permanent, edit src/allowlist.ts and update your Firestore rules. Run @rules to see the updated rules.`,
        },
      ];
    }

    case "remove": {
      const email = args[0]?.toLowerCase();
      if (!email) {
        return [{ id: crypto.randomUUID(), type: "error", text: "Usage: @remove <email>" }];
      }
      const idx = ALLOWED_EMAILS.indexOf(email);
      if (idx === -1) {
        return [{ id: crypto.randomUUID(), type: "response", text: `${email} is not on the list.` }];
      }
      if (email === ADMIN_EMAIL) {
        return [{ id: crypto.randomUUID(), type: "error", text: "Cannot remove the admin account." }];
      }
      ALLOWED_EMAILS.splice(idx, 1);
      return [
        {
          id: crypto.randomUUID(),
          type: "response",
          text: `Removed ${email}.\n\nNote: This change is temporary (in-memory only). To make it permanent, edit src/allowlist.ts and update your Firestore rules. Run @rules to see the updated rules.`,
        },
      ];
    }

    case "rules": {
      const emailList = ALLOWED_EMAILS.map((e) => `        "${e}"`).join(",\n");
      const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null
        && request.auth.token.email in [
${emailList}
        ];
    }
  }
}`;
      return [
        {
          id: crypto.randomUUID(),
          type: "response",
          text: "Paste these rules in Firebase Console → Firestore → Rules:\n\n" + rules,
        },
      ];
    }

    default:
      return [{ id: crypto.randomUUID(), type: "error", text: `Unknown command: @${cmd}. Try @help` }];
  }
}

export default function AdminConsole({ userEmail }: Props) {
  const [text, setText] = useState("");
  const [log, setLog] = useState<LogEntry[]>([
    { id: "welcome", type: "response", text: "Admin Console. Type @help for available commands." },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  if (userEmail !== ADMIN_EMAIL) {
    return (
      <div style={{ padding: "24px", color: "#f66" }}>
        Access denied. Admin only.
      </div>
    );
  }

  const handleSend = () => {
    if (!text.trim()) return;
    const command: LogEntry = { id: crypto.randomUUID(), type: "command", text: text.trim() };
    const results = processCommand(text);
    setLog((prev) => [...prev, command, ...results]);
    setText("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {log.map((entry) => (
          <div
            key={entry.id}
            style={{
              marginBottom: "12px",
              textAlign: entry.type === "command" ? "right" : "left",
            }}
          >
            <div
              style={{
                display: "inline-block",
                padding: "8px 12px",
                borderRadius: "12px",
                background:
                  entry.type === "command"
                    ? "#2a6"
                    : entry.type === "error"
                      ? "#633"
                      : "#333",
                color: entry.type === "error" ? "#faa" : "#fff",
                maxWidth: "85%",
                wordBreak: "break-word",
                whiteSpace: "pre-wrap",
                fontFamily: entry.type !== "command" ? "monospace" : "inherit",
                fontSize: entry.type !== "command" ? "13px" : "inherit",
              }}
            >
              {entry.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", padding: "12px", borderTop: "1px solid #333" }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="@help"
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #444",
            background: "#1a1a1a",
            color: "#fff",
            outline: "none",
            fontFamily: "monospace",
          }}
        />
        <button
          onClick={handleSend}
          style={{
            marginLeft: "8px",
            padding: "10px 20px",
            borderRadius: "8px",
            border: "none",
            background: "#2a6",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Run
        </button>
      </div>
    </div>
  );
}
