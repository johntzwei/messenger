import { useEffect, useRef, useState } from "react";
import { useAllowlist } from "../useAllowlist";
import type { RoomProps } from "./index";

const ADMIN_EMAIL = "johntzwei@gmail.com";

interface LogEntry {
  id: string;
  text: string;
  type: "cmd" | "ok" | "err";
}

const msg = (text: string, type: "ok" | "err" = "ok"): LogEntry => ({
  id: crypto.randomUUID(), text, type,
});

export default function AdminConsole({ userEmail, db }: RoomProps) {
  const { emails, add, remove } = useAllowlist(db);
  const [text, setText] = useState("");
  const [log, setLog] = useState<LogEntry[]>([msg("Admin Console. Type @help for commands.")]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [log]);

  if (userEmail !== ADMIN_EMAIL) return <div className="access-denied">Access denied. Admin only.</div>;

  const run = async (input: string) => {
    const parts = input.trim().split(/\s+/);
    if (!parts[0]?.startsWith("@")) return [msg("Commands start with @. Try @help", "err")];
    const cmd = parts[0].slice(1).toLowerCase();
    const arg = parts[1]?.toLowerCase();

    if (cmd === "help") return [msg("@list — Show users\n@add <email> — Add user\n@remove <email> — Remove user\n@help — This message")];
    if (cmd === "list") return [msg(emails.length ? emails.map((e, i) => `${i + 1}. ${e}`).join("\n") : "No users.")];
    if (cmd === "add") {
      if (!arg?.includes("@")) return [msg("Usage: @add <email>", "err")];
      if (emails.includes(arg)) return [msg(`${arg} already listed.`)];
      await add(arg);
      return [msg(`Added ${arg}.`)];
    }
    if (cmd === "remove") {
      if (!arg) return [msg("Usage: @remove <email>", "err")];
      if (!emails.includes(arg)) return [msg(`${arg} not on list.`)];
      if (arg === ADMIN_EMAIL) return [msg("Can't remove admin.", "err")];
      await remove(arg);
      return [msg(`Removed ${arg}.`)];
    }
    return [msg(`Unknown: @${cmd}`, "err")];
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    const cmd: LogEntry = { id: crypto.randomUUID(), type: "cmd", text: text.trim() };
    setText("");
    try {
      const results = await run(text);
      setLog((prev) => [...prev, cmd, ...results]);
    } catch (err: any) {
      setLog((prev) => [...prev, cmd, msg(err.message, "err")]);
    }
  };

  return (
    <div className="chat">
      <div className="chat-messages">
        {log.map((e) => (
          <div key={e.id} className={`chat-row${e.type === "cmd" ? " mine" : ""}`}>
            <div className={`console-bubble${e.type === "cmd" ? " cmd" : e.type === "err" ? " error" : ""}`}>
              {e.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row">
        <input className="chat-input mono" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="@help" />
        <button className="chat-send" onClick={handleSend}>Run</button>
      </div>
    </div>
  );
}
