"use client";

import { Archive, Bell, BellSlash, CheckCircle, EnvelopeSimple, PushPin, PushPinSlash } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useUnread } from "@/components/unread-provider";
import {
  markRoomReadAction,
  setChatPinnedAction,
  setMarkedUnreadAction,
  setRoomArchivedAction,
  setRoomMuteAction,
} from "@/app/(with-sidebar)/channels/[roomId]/room.action";

const HOUR = 60 * 60 * 1000;
const MUTES = [
  { value: "1h" as const, label: "1 jam", ms: HOUR },
  { value: "8h" as const, label: "8 jam", ms: 8 * HOUR },
  { value: "1w" as const, label: "1 minggu", ms: 168 * HOUR },
  { value: "forever" as const, label: "Sampai dinyalakan lagi", ms: null },
];

/**
 * Per-chat actions in the chat list, Telegram Web style: right-click a chat
 * (long-press on touch) to pin it, mark it read/unread, mute or archive it.
 * Everything applies locally first and rolls back if the server refuses.
 */
export function ChatListItemMenu({ roomId, children }: { roomId: string; children: React.ReactNode }) {
  const {
    unreadRooms, pinnedChats, setChatPinned, markAsRead, markAsUnreadManually,
    mutedRooms, setMuted, archivedRooms, setArchived,
  } = useUnread();
  const pinned = !!pinnedChats[roomId];
  const unread = !!unreadRooms[roomId]?.hasUnread;
  const muted = (mutedRooms[roomId] ?? 0) > Date.now();
  const archived = !!archivedRooms[roomId];

  const run = async (apply: () => void, undo: () => void, action: () => Promise<{ status: string; error: { message?: string } | null }>) => {
    apply();
    const res = await action();
    if (res.status !== "success") {
      undo();
      toast.error(res.error?.message || "Gagal memperbarui chat");
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem
          onSelect={() => {
            const previous = pinnedChats[roomId] ?? null;
            void run(
              () => setChatPinned(roomId, pinned ? null : new Date()),
              () => setChatPinned(roomId, previous ? new Date(previous) : null),
              () => setChatPinnedAction(roomId, !pinned),
            );
          }}
        >
          {pinned ? <PushPinSlash className="h-4 w-4" /> : <PushPin className="h-4 w-4" />}
          {pinned ? "Lepas sematan chat" : "Sematkan chat"}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() =>
            unread
              ? void run(() => markAsRead(roomId), () => markAsUnreadManually(roomId), () => markRoomReadAction(roomId))
              : void run(() => markAsUnreadManually(roomId), () => markAsRead(roomId), () => setMarkedUnreadAction(roomId, true))
          }
        >
          {unread ? <CheckCircle className="h-4 w-4" /> : <EnvelopeSimple className="h-4 w-4" />}
          {unread ? "Tandai sudah dibaca" : "Tandai belum dibaca"}
        </ContextMenuItem>
        {muted ? (
          <ContextMenuItem
            onSelect={() => {
              const previous = mutedRooms[roomId];
              void run(() => setMuted(roomId, null), () => setMuted(roomId, new Date(previous)), () => setRoomMuteAction(roomId, "off"));
            }}
          >
            <Bell className="h-4 w-4" />
            Bunyikan lagi
          </ContextMenuItem>
        ) : (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <BellSlash className="h-4 w-4" />
              Bisukan
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {MUTES.map((m) => (
                <ContextMenuItem
                  key={m.value}
                  onSelect={() =>
                    void run(
                      () => setMuted(roomId, m.ms ? new Date(Date.now() + m.ms) : new Date("9999-12-31T00:00:00.000Z")),
                      () => setMuted(roomId, null),
                      () => setRoomMuteAction(roomId, m.value),
                    )
                  }
                >
                  {m.label}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() =>
            void run(() => setArchived(roomId, !archived), () => setArchived(roomId, archived), () => setRoomArchivedAction(roomId, !archived))
          }
        >
          <Archive className="h-4 w-4" />
          {archived ? "Keluarkan dari arsip" : "Arsipkan chat"}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
