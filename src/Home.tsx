import rooms from "./rooms";

const ADMIN_EMAIL = "johntzwei@gmail.com";

interface Props {
  onSelectRoom: (roomId: string) => void;
  userEmail: string;
}

export default function Home({ onSelectRoom, userEmail }: Props) {
  const isAdmin = userEmail === ADMIN_EMAIL;

  return (
    <div style={{ padding: "24px" }}>
      <h2 style={{ marginBottom: "16px" }}>Rooms</h2>
      {Object.entries(rooms)
        .filter(([, room]) => !room.adminOnly || isAdmin)
        .map(([id, room]) => (
          <button
            key={id}
            onClick={() => onSelectRoom(id)}
            style={{
              display: "block",
              width: "100%",
              padding: "16px",
              marginBottom: "8px",
              borderRadius: "8px",
              border: "1px solid #333",
              background: "#1a1a1a",
              color: "#fff",
              textAlign: "left",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            {room.name}
          </button>
        ))}
    </div>
  );
}
