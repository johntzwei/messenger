import rooms from "./rooms";

export default function Home({ onSelectRoom }: { onSelectRoom: (id: string) => void }) {
  return (
    <div className="room-list">
      <h2 style={{ marginBottom: "16px" }}>Rooms</h2>
      {Object.entries(rooms).map(([id, room]) => (
        <button key={id} className="room-btn" onClick={() => onSelectRoom(id)}>{room.name}</button>
      ))}
    </div>
  );
}
