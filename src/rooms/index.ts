import type { ComponentType } from "react";
import type { Firestore } from "firebase/firestore";
import GeneralChat from "./GeneralChat";
import AdminConsole from "./AdminConsole";
import VimChat from "./VimChat";

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
  vim: { name: "Vim Users Only", component: VimChat },
};

export default rooms;
