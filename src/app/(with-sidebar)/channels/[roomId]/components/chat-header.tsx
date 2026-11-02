"use client";

import { useEffect, useState, useMemo } from "react";
import { Users, Info, MagnifyingGlass, CaretLeft, Hash, CircleNotch } from "@phosphor-icons/react/dist/ssr";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RoomWithParticipantsDTO } from "@/lib/entities/models/room.model";
import { UserAvatar } from "@/components/ui/user-avatar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useConnectionStatus } from "@/hooks/use-connection-status";
import { Shortcut } from "@/components/ui/kbd";
import { isPlainLeftClick, navigateToRoom } from "@/lib/chat/room-navigation";
import { MuteMenu } from "./mute-menu";
import type { BlockStatus } from "@/lib/entities/models/block.model";

// 800-line dialog pulling in Tabs, ScrollArea, AlertDialog, Switch and the
// image lightbox. It only renders when room details are opened, so it is split
// out of the eager chat header chunk.
const RoomDetailDialog = dynamic(
  () => import("./room-detail-dialog").then((m) => m.RoomDetailDialog),
  { ssr: false },
);

const LAST_SEEN_LABELS: Record<string, string> = {
  recently: "terakhir dilihat baru-baru ini",
  week: "terakhir dilihat minggu ini",
  month: "terakhir dilihat bulan ini",
  long: "terakhir dilihat sudah lama",
};

/** "terakhir dilihat 5 menit lalu" / "… kemarin 21.04" / rough label when exact is private. */
function formatLastSeen(user?: { lastSeenAt?: Date | string | null; lastSeenLabel?: string | null } | null) {
  if (!user) return null;
  if (user.lastSeenAt) {
    const at = new Date(user.lastSeenAt);
    const diff = Date.now() - at.getTime();
    const time = at.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    if (diff < 60_000) return "terakhir dilihat baru saja";
    if (diff < 60 * 60_000) return `terakhir dilihat ${Math.floor(diff / 60_000)} menit lalu`;
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60_000);
    if (at.toDateString() === today.toDateString()) return `terakhir dilihat hari ini ${time}`;
    if (at.toDateString() === yesterday.toDateString()) return `terakhir dilihat kemarin ${time}`;
    return `terakhir dilihat ${at.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} ${time}`;
  }
  return user.lastSeenLabel ? LAST_SEEN_LABELS[user.lastSeenLabel] ?? null : null;
}

interface ChatHeaderProps {
  roomData: RoomWithParticipantsDTO;
  currentUserId: string;
  onToggleMembers?: () => void;
  onToggleSearch?: () => void;
  membersVisible: boolean;
  onlineUserIds: string[];
  onUpdateRoom?: (data: Partial<RoomWithParticipantsDTO>) => void;
  blockStatus?: BlockStatus | null;
  onToggleBlock?: () => void;
}

export function ChatHeader({
  roomData,
  onToggleMembers,
  onToggleSearch,
  currentUserId,
  membersVisible,
  onlineUserIds,
  onUpdateRoom,
  blockStatus,
  onToggleBlock,
}: ChatHeaderProps) {
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const connection = useConnectionStatus();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const otherUser = useMemo(() => {
    if (!roomData.isDirect) return null;
    return roomData.participants.find((p) => p.user.id !== currentUserId)?.user ?? null;
  }, [roomData, currentUserId]);

  const roomName = useMemo(() => {
    if (roomData.isDirect) {
      return otherUser?.username ?? "Unknown user";
    }
    return roomData.name;
  }, [roomData, otherUser]);

  const isBlocked = !!(blockStatus?.iBlocked || blockStatus?.blockedMe);
  const isOtherUserOnline = useMemo(() => {
    // Across a block neither side sees the other's online status.
    return otherUser && !isBlocked ? onlineUserIds.includes(otherUser.id) : false;
  }, [otherUser, onlineUserIds, isBlocked]);
  const lastSeenText = useMemo(() => formatLastSeen(otherUser), [otherUser]);

  const onlineCount = useMemo(() => {
    return roomData.participants.filter((p) =>
      onlineUserIds.includes(p.user.id),
    ).length;
  }, [roomData.participants, onlineUserIds]);

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-background sticky top-0 z-10 px-3 md:px-4 h-14 shrink-0">
      <div className="flex items-center gap-1 min-w-0 flex-1">
        {/* Sidebar Trigger - Mobile only */}
        {isMounted && (
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors shrink-0 -ml-1 mr-0.5"
              aria-label="Kembali ke channels"
            >
              <Link
                href="/channels/default"
                prefetch={false}
                onClick={(e) => {
                  if (isPlainLeftClick(e)) {
                    e.preventDefault();
                    navigateToRoom("/channels/default", router);
                  }
                }}
              >
                <CaretLeft weight="bold" className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowDetails(true)}
          className="flex items-center gap-2.5 min-w-0 -my-1 py-1 pl-1 pr-2 -ml-1 rounded-md hover:bg-muted/60 transition-colors text-left"
          aria-label={roomData.isDirect ? "Lihat profil" : "Lihat info channel"}
        >
          <div className="relative shrink-0">
            {roomData.isDirect ? (
              <UserAvatar
                src={otherUser?.avatar || "/avatars/avatar1.png"}
                alt={roomName}
                className="h-8 w-8 rounded-full"
              />
            ) : roomData.avatar ? (
              <UserAvatar src={roomData.avatar} alt={roomName} className="h-8 w-8 rounded-lg" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Hash weight="bold" className="h-4 w-4" />
              </span>
            )}
            {roomData.isDirect && (
              <span
                className={cn(
                  "absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full ring-2 ring-background",
                  isOtherUserOnline ? "bg-emerald-500" : "bg-muted-foreground/40",
                )}
              />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <h1 className="text-sm font-semibold text-foreground leading-tight truncate">
              {roomData.isDirect ? (otherUser?.name || roomName) : roomName}
            </h1>
            <p className="text-xs text-muted-foreground leading-tight truncate mt-0.5">
              {connection !== "online" ? (
                <span className="inline-flex items-center gap-1.5">
                  {connection === "connecting" ? (
                    <CircleNotch className="h-3 w-3 animate-spin" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                  )}
                  {connection === "connecting" ? "Menghubungkan…" : "Tidak ada koneksi"}
                </span>
              ) : roomData.isDirect ? (
                isOtherUserOnline
                  ? "Online"
                  : (!isBlocked && lastSeenText) || otherUser?.customStatus || `@${otherUser?.username ?? ""}`
              ) : (
                <>
                  {roomData.participants.length} anggota
                  {onlineCount > 0 && (
                    <>
                      <span className="mx-1 text-muted-foreground/50">·</span>
                      <span className="text-emerald-600 dark:text-emerald-400">{onlineCount} online</span>
                    </>
                  )}
                  {roomData.description && (
                    <span className="hidden md:inline">
                      <span className="mx-1 text-muted-foreground/50">·</span>
                      {roomData.description}
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
        </button>
      </div>
      <div className="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center">
                {/* Desktop: Slack/Linear Style Search Input Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onToggleSearch}
                  className="hidden md:flex items-center justify-between gap-3 h-8 w-52 px-2.5 text-muted-foreground hover:text-foreground transition-colors border-border bg-muted/40 hover:bg-muted rounded-md text-xs font-normal shadow-none mr-1"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MagnifyingGlass className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Cari di room ini</span>
                  </div>
<Shortcut keys={["mod", "f"]} className="pointer-events-none" keyClassName="h-[18px] min-w-[18px] text-[10px] bg-background" />
                </Button>

                {/* Mobile: Simple Icon Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleSearch}
                  className="md:hidden h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors flex-shrink-0"
                >
                  <MagnifyingGlass className="h-[18px] w-[18px]" />
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Cari di room ini</p>
            </TooltipContent>
          </Tooltip>

          <MuteMenu roomId={roomData.id} />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDetails(true)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors flex-shrink-0"
              >
                <Info className="h-[18px] w-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{roomData.isDirect ? "Profil Pengguna" : "Informasi Channel"}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleMembers}
                className={cn(
                  // The desktop member panel only exists from lg up; between md
                  // and lg this button had nothing to toggle.
                  "md:hidden lg:inline-flex h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors flex-shrink-0",
                  membersVisible && "bg-muted text-foreground",
                )}
              >
                <Users className="h-[18px] w-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{membersVisible ? "Sembunyikan daftar anggota" : "Tampilkan daftar anggota"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Room Detail Dialog */}
      <RoomDetailDialog
        open={showDetails}
        onOpenChange={setShowDetails}
        roomData={roomData}
        currentUserId={currentUserId}
        onUpdateRoom={onUpdateRoom}
        onlineUserIds={onlineUserIds}
        onSearch={onToggleSearch}
        blockStatus={blockStatus}
        onToggleBlock={onToggleBlock}
      />
    </div>
  );
}
