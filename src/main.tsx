import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth, db, googleProvider } from "./firebase";
import { useAllowlist } from "./useAllowlist";
import Home from "./Home";
import rooms from "./rooms";
import "./index.css";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const { emails: allowedEmails, loading: allowlistLoading } = useAllowlist(db);

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); }), []);

  if (loading || allowlistLoading) return <div className="center">Loading...</div>;

  if (!user) {
    return (
      <div className="center">
        <h1>Johnny's Messenger</h1>
        <p className="subtitle">secure hackable chat</p>
        <button className="btn" onClick={() => signInWithPopup(auth, googleProvider)}>Sign in with Google</button>
      </div>
    );
  }

  if (allowedEmails.length > 0 && !allowedEmails.includes(user.email || "")) {
    return (
      <div className="center">
        <h1>Johnny's Messenger</h1>
        <p className="error-text">You're not on the list, sorry!</p>
        <button className="btn" onClick={() => signOut(auth)}>Sign out</button>
      </div>
    );
  }

  if (currentRoom && rooms[currentRoom]) {
    const Room = rooms[currentRoom].component;
    return (
      <div className="page">
        <div className="header">
          <button className="header-back" onClick={() => setCurrentRoom(null)}>&larr; Back</button>
          <span style={{ fontWeight: "bold" }}>{rooms[currentRoom].name}</span>
          <span className="header-user">{user.displayName}</span>
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <Room roomId={currentRoom} userId={user.uid} userName={user.displayName || "Anonymous"} userEmail={user.email || ""} db={db} />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="header">
        <span className="header-title">Johnny's Messenger</span>
        <button className="header-signout" onClick={() => signOut(auth)}>Sign out</button>
      </div>
      <Home onSelectRoom={setCurrentRoom} />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
