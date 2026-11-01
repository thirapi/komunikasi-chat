import { RoomHost } from "./room-host";

export default function ChannelsLayout({ children }: { children: React.ReactNode }) {
  return <RoomHost>{children}</RoomHost>;
}
