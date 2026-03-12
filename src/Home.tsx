import { forwardRef } from "react";
import rooms from "./rooms";

export default forwardRef<HTMLDivElement, { onSelectRoom: (id: string) => void }>(
  function Home({ onSelectRoom }, ref) {
    return (
      <div className="room-list" ref={ref}>
        <h2 style={{ marginBottom: "16px" }}>Rooms</h2>
        {Object.entries(rooms).map(([id, room]) => (
          <button key={id} className="room-btn" onClick={() => onSelectRoom(id)}>{room.name}</button>
        ))}
      </div>
    );
  }
);
