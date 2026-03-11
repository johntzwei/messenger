import type { ComponentType } from "react";
import type { Firestore } from "firebase/firestore";
import GeneralChat from "./GeneralChat";

// Room component props — every room file gets these
export interface RoomProps {
  roomId: string;
  userId: string;
  userName: string;
  db: Firestore;
}

// Registry: map room IDs to their components
// To add a new room: import your file and add a line here
const rooms: Record<string, { name: string; component: ComponentType<RoomProps> }> = {
  general: { name: "General", component: GeneralChat },
  // example:
  // dnd: { name: "D&D Night", component: DnDRoom },
  // movies: { name: "Movie Night", component: MovieNight },
};

export default rooms;
