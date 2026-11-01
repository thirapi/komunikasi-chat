"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { roomIdFromPath, setRoomHostMounted } from "@/lib/chat/room-navigation";
import { ChatRoomClientWrapper } from "./[roomId]/components/chat-room-client-wrapper";
import { ChatEmptyState } from "../chat-empty-state";
import { useCurrentUser } from "@/components/current-user-provider";

/**
 * Renders the open chat from the URL on the client.
 *
 * Living in the /channels layout (instead of the [roomId] page) means switching
 * rooms needs no server render: the sidebar updates the URL with
 * history.pushState (see navigateToRoom), usePathname changes on the same frame
 * and this re-renders straight from the client cache. Ordinary router.push /
 * <Link> navigations still work — they just take the normal route.
 */
export function RoomHost({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const roomId = roomIdFromPath(pathname);
  const user = useCurrentUser();

  // Lets navigateToRoom know client-side switching is available.
  useEffect(() => {
    setRoomHostMounted(true);
    return () => setRoomHostMounted(false);
  }, []);

  if (!roomId) {
    return (
      <>
        <ChatEmptyState name={user?.name || user?.username || "kamu"} />
        {children}
      </>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full min-h-0">
      <ChatRoomClientWrapper key={roomId} roomId={roomId} />
    </div>
  );
}
