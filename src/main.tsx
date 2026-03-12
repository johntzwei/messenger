import { StrictMode, useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth, db, googleProvider } from "./firebase";
import { useAllowlist } from "./useAllowlist";
import { useNotifications } from "./useNotifications";
import { useSwipeBack } from "./useSwipeBack";
import { usePullToRefresh } from "./usePullToRefresh";
import Home from "./Home";
import rooms from "./rooms";
import type { RoomProps } from "./rooms";
import "./index.css";

function RoomView({ onBack, ...roomProps }: { onBack: () => void } & RoomProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  useSwipeBack(pageRef, onBack);
  const Room = rooms[roomProps.roomId].component;
  return (
    <div className="page" ref={pageRef}>
      <div className="header">
        <button className="header-back" onClick={onBack}>&larr; Back</button>
        <span style={{ fontWeight: "bold" }}>{rooms[roomProps.roomId].name}</span>
        <span className="header-user">{roomProps.userName}</span>
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <Room {...roomProps} />
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const { emails: allowedEmails, loading: allowlistLoading } = useAllowlist(db);
  const { permission, supported, requestPermission } = useNotifications(db, user?.uid ?? null);

  const homeListRef = useRef<HTMLDivElement>(null);

  const goBack = useCallback(() => setCurrentRoom(null), []);
  usePullToRefresh(homeListRef);

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
    return (
      <RoomView
        roomId={currentRoom}
        onBack={goBack}
        userId={user.uid}
        userName={user.displayName || "Anonymous"}
        userEmail={user.email || ""}
        db={db}
      />
    );
  }

  return (
    <div className="page">
      <div className="header">
        <span className="header-title">Johnny's Messenger</span>
        {supported && permission !== "granted" && (
          <button className="header-notify" onClick={requestPermission} title="Enable notifications">
            Notifications
          </button>
        )}
        <button className="header-signout" onClick={() => signOut(auth)}>Sign out</button>
      </div>
      <Home ref={homeListRef} onSelectRoom={setCurrentRoom} />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
