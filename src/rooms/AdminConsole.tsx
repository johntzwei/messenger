import { useEffect, useRef, useState } from "react";
import { Firestore } from "firebase/firestore";
import { useAllowlist } from "../useAllowlist";

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

function reply(text: string, type: "response" | "error" = "response"): LogEntry {
  return { id: crypto.randomUUID(), text, type };
}

export default function AdminConsole({ userEmail, db }: Props) {
  const { emails, add, remove } = useAllowlist(db);
  const [text, setText] = useState("");
  const [log, setLog] = useState<LogEntry[]>([
    reply("Admin Console. Type @help for available commands."),
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

  const processCommand = async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed.startsWith("@")) {
      return [reply("Commands must start with @. Try @help", "error")];
    }

    const [cmd, ...args] = trimmed.slice(1).split(/\s+/);

    switch (cmd.toLowerCase()) {
      case "help":
        return [
          reply(
            [
              "Available commands:",
              "",
              "  @list              — Show all allowed users",
              "  @add <email>       — Add a user to the allowlist",
              "  @remove <email>    — Remove a user from the allowlist",
              "  @help              — Show this help message",
            ].join("\n"),
          ),
        ];

      case "list":
        return [
          reply(
            emails.length
              ? "Allowed users:\n\n" + emails.map((e, i) => `  ${i + 1}. ${e}`).join("\n")
              : "Allowlist is empty (all users permitted).",
          ),
        ];

      case "add": {
        const email = args[0]?.toLowerCase();
        if (!email || !email.includes("@")) {
          return [reply("Usage: @add <email>", "error")];
        }
        if (emails.includes(email)) {
          return [reply(`${email} is already on the list.`)];
        }
        await add(email);
        return [reply(`Added ${email}.`)];
      }

      case "remove": {
        const email = args[0]?.toLowerCase();
        if (!email) {
          return [reply("Usage: @remove <email>", "error")];
        }
        if (!emails.includes(email)) {
          return [reply(`${email} is not on the list.`)];
        }
        if (email === ADMIN_EMAIL) {
          return [reply("Cannot remove the admin account.", "error")];
        }
        await remove(email);
        return [reply(`Removed ${email}.`)];
      }

      default:
        return [reply(`Unknown command: @${cmd}. Try @help`, "error")];
    }
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    const command: LogEntry = { id: crypto.randomUUID(), type: "command", text: text.trim() };
    setText("");
    try {
      const results = await processCommand(text);
      setLog((prev) => [...prev, command, ...results]);
    } catch (err: any) {
      setLog((prev) => [...prev, command, reply(`Error: ${err.message}`, "error")]);
    }
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
