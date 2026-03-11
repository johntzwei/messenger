import rooms from "./rooms";

interface Props {
  onSelectRoom: (roomId: string) => void;
}

export default function Home({ onSelectRoom }: Props) {
  return (
    <div style={{ padding: "24px" }}>
      <h2 style={{ marginBottom: "16px" }}>Rooms</h2>
      {Object.entries(rooms).map(([id, room]) => (
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
