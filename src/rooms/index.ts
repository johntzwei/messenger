import type { ComponentType } from "react";
import type { Firestore } from "firebase/firestore";
import GeneralChat from "./GeneralChat";
import AdminConsole from "./AdminConsole";
import VimChat from "./VimChat";
import MirrorChat from "./MirrorChat";
import Leaderboard from "./Leaderboard";
import WishingWell from "./WishingWell";
import ElizaChat from "./ElizaChat";
import AliceChat from "./AliceChat";
import ElizaPlusChat from "./ElizaPlusChat";

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
  mirror: { name: "Mirror World", component: MirrorChat },
  leaderboard: { name: "Leaderboard", component: Leaderboard },
  wishingwell: { name: "Wishing Well", component: WishingWell },
  eliza: { name: "Speak with ELIZA", component: ElizaChat },
  alice: { name: "Alice in Wonderland", component: AliceChat },
  'eliza++': { name: "ELIZA++", component: ElizaPlusChat },
};

export default rooms;
