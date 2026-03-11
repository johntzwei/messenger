import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth, db, googleProvider } from "./firebase";
import { ALLOWED_EMAILS } from "./allowlist";
import Home from "./Home";
import rooms from "./rooms";
import "./index.css";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);

  // Listen for auth changes
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="center">Loading...</div>;

  // Signed in but not on the allowlist — kick them out
  if (user && ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(user.email || "")) {
    return (
      <div className="center">
        <h1>Johnny's Messenger</h1>
        <p style={{ color: "#f66", marginBottom: "24px" }}>You're not on the list, sorry!</p>
        <button className="btn" onClick={() => signOut(auth)}>Sign out</button>
      </div>
    );
  }

  // Not signed in — show login
  if (!user) {
    return (
      <div className="center">
        <h1>Johnny's Messenger</h1>
        <p style={{ color: "#888", marginBottom: "24px" }}>secure hackable chat</p>
        <button className="btn" onClick={() => signInWithPopup(auth, googleProvider)}>
          Sign in with Google
        </button>
      </div>
    );
  }

  // Signed in, in a room — render that room's component
  if (currentRoom && rooms[currentRoom]) {
    const RoomComponent = rooms[currentRoom].component;
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "12px 16px",
            borderBottom: "1px solid #333",
          }}
        >
          <button
            onClick={() => setCurrentRoom(null)}
            style={{
              background: "none",
              border: "none",
              color: "#2a6",
              cursor: "pointer",
              fontSize: "16px",
              marginRight: "12px",
            }}
          >
            &larr; Back
          </button>
          <span style={{ fontWeight: "bold" }}>{rooms[currentRoom].name}</span>
          <span style={{ marginLeft: "auto", fontSize: "12px", color: "#888" }}>
            {user.displayName}
          </span>
        </div>

        {/* Room content */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          <RoomComponent
            roomId={currentRoom}
            userId={user.uid}
            userName={user.displayName || "Anonymous"}
            userEmail={user.email || ""}
            db={db}
          />
        </div>
      </div>
    );
  }

  // Signed in, no room selected — show room list
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: "1px solid #333",
        }}
      >
        <span style={{ fontWeight: "bold", fontSize: "18px" }}>Johnny's Messenger</span>
        <button
          onClick={() => signOut(auth)}
          style={{
            marginLeft: "auto",
            background: "none",
            border: "1px solid #444",
            color: "#888",
            padding: "6px 12px",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </div>
      <Home onSelectRoom={setCurrentRoom} userEmail={user.email || ""} />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
