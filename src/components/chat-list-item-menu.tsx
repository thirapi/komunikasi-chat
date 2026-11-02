"use client";

import { Archive, Bell, BellSlash, CheckCircle, DotsThree, EnvelopeSimple, PushPin, PushPinSlash } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
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
 * Per-chat actions in the chat list (WhatsApp/Telegram): pin, mark as
 * read/unread, mute, archive. Opened from the "⋯" button on hover or by
 * right-click / long-press on the row. Everything applies locally first and
 * rolls back if the server refuses.
 */
export function ChatListItemMenu({
  roomId,
  open,
  onOpenChange,
}: {
  roomId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
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
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Opsi chat"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md bg-sidebar text-muted-foreground shadow-sm ring-1 ring-border transition-opacity hover:text-foreground",
            open ? "opacity-100" : "opacity-0 group-hover/chat:opacity-100 focus-visible:opacity-100",
          )}
        >
          <DotsThree weight="bold" className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem
          onSelect={() => {
            const previous = pinnedChats[roomId] ?? null;
            void run(
              () => setChatPinned(roomId, pinned ? null : new Date()),
              () => setChatPinned(roomId, previous ? new Date(previous) : null),
              () => setChatPinnedAction(roomId, !pinned),
            );
          }}
        >
          {pinned ? <PushPinSlash className="mr-2 h-4 w-4" /> : <PushPin className="mr-2 h-4 w-4" />}
          {pinned ? "Lepas sematan chat" : "Sematkan chat"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            unread
              ? void run(() => markAsRead(roomId), () => markAsUnreadManually(roomId), () => markRoomReadAction(roomId))
              : void run(() => markAsUnreadManually(roomId), () => markAsRead(roomId), () => setMarkedUnreadAction(roomId, true))
          }
        >
          {unread ? <CheckCircle className="mr-2 h-4 w-4" /> : <EnvelopeSimple className="mr-2 h-4 w-4" />}
          {unread ? "Tandai sudah dibaca" : "Tandai belum dibaca"}
        </DropdownMenuItem>
        {muted ? (
          <DropdownMenuItem
            onSelect={() => {
              const previous = mutedRooms[roomId];
              void run(() => setMuted(roomId, null), () => setMuted(roomId, new Date(previous)), () => setRoomMuteAction(roomId, "off"));
            }}
          >
            <Bell className="mr-2 h-4 w-4" />
            Bunyikan lagi
          </DropdownMenuItem>
        ) : (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <BellSlash className="mr-2 h-4 w-4" />
              Bisukan
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {MUTES.map((m) => (
                <DropdownMenuItem
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
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            void run(() => setArchived(roomId, !archived), () => setArchived(roomId, archived), () => setRoomArchivedAction(roomId, !archived))
          }
        >
          <Archive className="mr-2 h-4 w-4" />
          {archived ? "Keluarkan dari arsip" : "Arsipkan chat"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
