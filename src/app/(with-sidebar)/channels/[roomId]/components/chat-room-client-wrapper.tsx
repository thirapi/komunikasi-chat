"use client";

import { useEffect, useState } from "react";
import { getUserSession, sidaBarUserInfo } from "@/app/auth.action";
import { getRoomSnapshot } from "../room.action";
import { ChatRoom } from "./chat-room";
import { clientChatCache } from "@/lib/infrastructure/cache/client-cache";
import { Warning } from "@phosphor-icons/react/dist/ssr";
import LoadingRoom from "../room-skeleton";
import { useCurrentUser, type CurrentUser } from "@/components/current-user-provider";
import type { MessageWithUserDTO } from "@/lib/entities/models/message.model";

/**
 * How many cached messages to mount when a room opens. Mounting the whole cache
 * (up to several hundred rows of markdown) is what made switching feel heavy;
 * older rows are paged back in on scroll exactly like a fresh load.
 */
const INITIAL_RENDER_WINDOW = 80;

function windowMessages(messages: MessageWithUserDTO[], lastReadId: string | null) {
  if (messages.length <= INITIAL_RENDER_WINDOW) return messages;
  let start = messages.length - INITIAL_RENDER_WINDOW;
  // Keep a little context above the unread marker so it still renders.
  if (lastReadId) {
    const idx = messages.findIndex((m) => m.id === lastReadId);
    if (idx !== -1) start = Math.min(start, Math.max(0, idx - 5));
  }
  return messages.slice(start);
}

type RoomState = {
  userId: string;
  roomData: any;
  initialMessages: MessageWithUserDTO[];
  lastReadMessageId: string | null;
  lastReadAt: Date | null;
  user: CurrentUser;
  /** True once the data comes from the server rather than the local cache. */
  isFresh: boolean;
};

function fromMemory(roomId: string, user: CurrentUser | null): RoomState | null {
  const room = clientChatCache.getRoomSync(roomId);
  if (!room) return null;
  const lastRead = clientChatCache.getLastReadSync(roomId);
  return {
    userId: user?.id ?? "",
    roomData: room,
    initialMessages: windowMessages(clientChatCache.getMessagesSync(roomId) ?? [], lastRead.id),
    lastReadMessageId: lastRead.id,
    lastReadAt: lastRead.at,
    user: user ?? { id: "", name: "", username: "", avatar: "" },
    isFresh: false,
  };
}

export function ChatRoomClientWrapper({ roomId }: { roomId: string }) {
  const currentUser = useCurrentUser();
  // First paint comes straight from the in-memory cache (filled by earlier
  // visits and by hover-prefetch in the sidebar), so an already-seen room
  // renders on the very first frame with no skeleton.
  const [data, setData] = useState<RoomState | null>(() => fromMemory(roomId, currentUser));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function resolveUser(): Promise<CurrentUser> {
      if (currentUser?.id) return currentUser;
      // Fallback for trees without the provider.
      const [session, info] = await Promise.all([getUserSession(), sidaBarUserInfo()]);
      return {
        id: session?.user?.id ?? "",
        name: info.name,
        username: info.username,
        avatar: info.avatar,
      };
    }

    async function init() {
      try {
        const user = await resolveUser();

        // 1. Local first: IndexedDB, when memory did not have it.
        if (!clientChatCache.getRoomSync(roomId)) {
          const [cachedRoom, cachedMessages, cachedLastRead] = await Promise.all([
            clientChatCache.getRoom(roomId),
            clientChatCache.getMessages(roomId),
            clientChatCache.getLastRead(roomId),
          ]);
          if (cachedRoom && isMounted) {
            setData({
              userId: user.id,
              roomData: cachedRoom,
              initialMessages: windowMessages(cachedMessages ?? [], cachedLastRead?.id ?? null),
              lastReadMessageId: cachedLastRead?.id ?? null,
              lastReadAt: cachedLastRead?.at ?? null,
              user,
              isFresh: false,
            });
          }
        }

        // 2. Revalidate over the network in the background, in one request.
        const snapshot = await getRoomSnapshot(roomId);
        if (!isMounted) return;
        if (snapshot.status !== "success" || !snapshot.data) {
          if (!clientChatCache.getRoomSync(roomId)) setError("Gagal memuat room");
          return;
        }

        const fetchedMessages = snapshot.data.messages;
        const fetchedLastRead = snapshot.data.lastRead;
        const lastReadAt = fetchedLastRead?.at ? new Date(fetchedLastRead.at) : null;
        const roomResponse = { data: snapshot.data.room };

        void clientChatCache.setRoom(roomId, roomResponse.data);
        void clientChatCache.setMessages(roomId, fetchedMessages);
        void clientChatCache.setLastRead(roomId, fetchedLastRead?.id || null, lastReadAt);

        setData({
          userId: user.id,
          roomData: roomResponse.data,
          initialMessages: fetchedMessages,
          lastReadMessageId: fetchedLastRead?.id || null,
          lastReadAt,
          user,
          isFresh: true,
        });
      } catch (e) {
        console.error("Initialization error:", e);
        if (isMounted && !clientChatCache.getRoomSync(roomId)) setError("Terjadi kesalahan sistem");
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [roomId, currentUser?.id]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-8 text-center gap-3">
        <Warning className="text-muted-foreground w-10 h-10" />
        <h1 className="text-base font-semibold">{error}</h1>
        <p className="text-sm text-muted-foreground">Periksa koneksi atau coba muat ulang halaman.</p>
      </div>
    );
  }

  if (!data) {
    return <LoadingRoom />;
  }

  return (
    <ChatRoom
      key={roomId}
      userId={data.userId}
      roomData={data.roomData}
      initialMessages={data.initialMessages}
      lastReadMessageId={data.lastReadMessageId}
      lastReadAt={data.lastReadAt}
      user={data.user}
      isFresh={data.isFresh}
    />
  );
}
