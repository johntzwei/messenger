import type { ComponentType } from "react";
import type { Firestore } from "firebase/firestore";
import GeneralChat from "./GeneralChat";
import AdminConsole from "./AdminConsole";

export interface RoomProps {
  roomId: string;
  userId: string;
  userName: string;
  userEmail: string;
  db: Firestore;
}

const rooms: Record<string, { name: string; component: ComponentType<RoomProps> }> = {
  general: { name: "General", component: GeneralChat },
  admin: { name: "Admin Console", component: AdminConsole },
};

export default rooms;
