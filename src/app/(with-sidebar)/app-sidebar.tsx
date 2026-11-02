"use client";

import * as React from "react";
import {
  User,
  Hash,
  MagnifyingGlass,
  Compass,
  PencilSimple,
  X,
  GearSix,
  SignOut,
  SealCheck,
  BellSlash,
  BookmarkSimple,
  Archive,
  CaretLeft,
  PushPin,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";

import {
  Sidebar,
  SidebarContent,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/ui/user-avatar";
import { SidebarRoomDTO } from "@/lib/entities/models/room.model";
import { createRoom, getSidebarData } from "./channels/[roomId]/room.action";
import { useUnread } from "@/components/unread-provider";
import { usePresence } from "@/components/presence-provider";
import { useCustomEmojis } from "@/components/emoji-provider";
import { stripMarkdown } from "@/lib/strip-markdown";
import { clientChatCache } from "@/lib/infrastructure/cache/client-cache";
import { signOutUserAction } from "@/app/auth.action";
import { ModeToggleItem } from "@/components/landingpage/mode-toggle-nav-user";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Shortcut } from "@/components/ui/kbd";
import { onAppCommand } from "@/lib/chat/app-commands";
import { SavedMessagesDialog } from "@/components/saved-messages-dialog";
import { ChatListItemMenu } from "@/components/chat-list-item-menu";
import { isPlainLeftClick, navigateToRoom, prefetchRoom, warmRecentRooms } from "@/lib/chat/room-navigation";

// Dialogs loaded on demand
const CreateChannelDialog = dynamic(
  () => import("./create-channel-dialog").then((m) => m.CreateChannelDialog),
  { ssr: false }
);
const ExploreChannelsDialog = dynamic(
  () => import("./explore-channels-dialog").then((m) => m.ExploreChannelsDialog),
  { ssr: false }
);
const SearchUserDialog = dynamic(
  () => import("./search-user-dialog").then((m) => m.SearchUserDialog),
  { ssr: false }
);
const DirectMessageDialog = dynamic(
  () => import("./direct-message-dialog").then((m) => m.DirectMessageDialog),
  { ssr: false }
);
const MessageSearch = dynamic(
  () => import("@/components/message-search").then((m) => m.MessageSearch),
  { ssr: false }
);

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  groupRooms: SidebarRoomDTO[];
  directRooms: SidebarRoomDTO[];
  user: {
    id: string;
    name: string;
    username: string;
    initial: string;
    role: string;
    email: string;
    avatar: string;
    bio?: string | null;
    banner?: string | null;
    customStatus?: string | null;
  } | null;
  checkRole: {
    id: string;
    username: string;
    roles: {
      id: string;
      name: string;
    }[];
  } | null;
}

export function AppSidebar({
  user,
  checkRole,
  groupRooms: serverGroupRooms,
  directRooms: serverDirectRooms,
  ...props
}: AppSidebarProps) {
  // The chat list can be re-fetched on the client ("refresh-sidebar": a DM
  // someone just started, a deleted message changing a preview or unread
  // count). That used to be router.refresh(), which re-rendered the whole
  // server tree; now it is one getSidebarData call. A newer server render
  // (props change) takes over again.
  const [liveRooms, setLiveRooms] = React.useState<{
    channels: SidebarRoomDTO[];
    directMessages: SidebarRoomDTO[];
  } | null>(null);
  React.useEffect(() => setLiveRooms(null), [serverGroupRooms, serverDirectRooms]);
  const groupRooms = liveRooms?.channels ?? serverGroupRooms;
  const directRooms = liveRooms?.directMessages ?? serverDirectRooms;

  const sidebarRefreshRef = React.useRef<{ timer: ReturnType<typeof setTimeout> | null; seq: number }>({
    timer: null,
    seq: 0,
  });
  const refreshSidebar = React.useCallback(() => {
    if (!user?.id) return;
    const state = sidebarRefreshRef.current;
    // Coalesce bursts (several deletions, a message plus its room appearing).
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(async () => {
      state.timer = null;
      const seq = ++state.seq;
      const res = await getSidebarData(user.id);
      // Only the latest request may land; an older, slower one must not win.
      if (seq !== state.seq || res.status !== "success" || !res.data) return;
      setLiveRooms(res.data);
    }, 250);
  }, [user?.id]);
  React.useEffect(() => {
    const state = sidebarRefreshRef.current;
    return () => {
      if (state.timer) clearTimeout(state.timer);
    };
  }, []);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobileFromHook = useIsMobile();
  const { setOpenMobile } = useSidebar();
  const { unreadRooms, roomActivity, roomTyping, mutedRooms, archivedRooms, pinnedChats, initializeUnread } = useUnread();
  const [showArchive, setShowArchive] = React.useState(false);
  const { onlineUserIds } = usePresence();
  const customEmojis = useCustomEmojis();

  // Dialog and navigation state
  const [openCreateChannel, setOpenCreateChannel] = React.useState(false);
  const [openExploreChannels, setOpenExploreChannels] = React.useState(false);
  const [openSearchUser, setOpenSearchUser] = React.useState(false);
  const [openDMDialog, setOpenDMDialog] = React.useState(false);
  const [openGlobalSearch, setOpenGlobalSearch] = React.useState(false);
  const [openSaved, setOpenSaved] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeFolderTab, setActiveFolderTab] = React.useState<"all" | "channels" | "dms">("all");
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const isMobile = isMobileFromHook ?? false;
  const isDefaultRoom = pathname === "/channels/default" || pathname === "/channels";
  const isAdmin = checkRole?.roles.some((r) => r.name.toLowerCase() === "admin");

  // Prefetch default room
  React.useEffect(() => {
    router.prefetch("/channels/default");
  }, [router]);

  // Lift the most recent chats from IndexedDB into memory while idle, so the
  // first click on any of them paints instantly.
  const recentRoomIds = React.useMemo(
    () =>
      [...groupRooms, ...directRooms]
        .sort((a, b) => new Date(b.lastMessageTime ?? 0).getTime() - new Date(a.lastMessageTime ?? 0).getTime())
        .slice(0, 12)
        .map((r) => r.id)
        .join(","),
    [groupRooms, directRooms],
  );
  React.useEffect(() => warmRecentRooms(recentRoomIds ? recentRoomIds.split(",") : []), [recentRoomIds]);

  // Sync tab with URL
  React.useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl === "channels") setActiveFolderTab("channels");
    else if (tabFromUrl === "dms") setActiveFolderTab("dms");
  }, [searchParams]);

  // Global shortcut: Cmd+K / Ctrl+K for search
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpenGlobalSearch(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Commands from elsewhere in the app (empty state, menus) open the dialogs
  // this sidebar owns.
  React.useEffect(
    () =>
      onAppCommand((command) => {
        if (command === "search") setOpenGlobalSearch(true);
        else if (command === "new-dm") setOpenDMDialog(true);
        else if (command === "create-channel") setOpenCreateChannel(true);
        else if (command === "explore-channels") setOpenExploreChannels(true);
        else if (command === "refresh-sidebar") refreshSidebar();
        else if (command === "saved-messages") setOpenSaved(true);
      }),
    [refreshSidebar],
  );

  React.useEffect(() => {
    initializeUnread(
      [...groupRooms, ...directRooms].map((r) => ({
        id: r.id,
        hasUnread: r.hasUnread,
        hasMention: (r as any).hasMention,
        unreadCount: r.unreadCount,
        mutedUntil: r.mutedUntil,
        archivedAt: r.archivedAt,
        chatPinnedAt: r.chatPinnedAt,
        markedUnread: r.markedUnread,
        lastMessageTime: r.lastMessageTime,
      }))
    );
  }, [groupRooms, directRooms, initializeUnread]);

  // Live last-message preview/time from realtime events, used when newer than
  // the server-rendered sidebar data. Also drives the recency ordering below.
  const liveActivity = React.useCallback(
    (room: { id: string; lastMessage?: string; lastMessageTime?: Date }) => {
      const live = roomActivity[room.id];
      if (!live) return {};
      const serverTime = room.lastMessageTime ? new Date(room.lastMessageTime).getTime() : 0;
      if (live.lastMessageTime.getTime() < serverTime) return {};
      return { lastMessage: live.lastMessage, lastMessageTime: live.lastMessageTime };
    },
    [roomActivity],
  );

  const groups = React.useMemo(() => {
    return groupRooms.map((room) => ({
      ...room,
      isChannel: true,
      icon: Hash,
      hasUnread: unreadRooms[room.id]?.hasUnread ?? room.hasUnread,
      hasMention: unreadRooms[room.id]?.hasMention ?? room.hasMention,
      unreadCount: unreadRooms[room.id]?.count ?? room.unreadCount ?? 0,
      ...liveActivity(room),
    }));
  }, [groupRooms, unreadRooms, liveActivity]);

  const directMessages = React.useMemo(() => {
    return directRooms.map((room) => ({
      ...room,
      isChannel: false,
      userId: room.userId ?? "",
      icon: User,
      hasUnread: unreadRooms[room.id]?.hasUnread ?? room.hasUnread,
      hasMention: unreadRooms[room.id]?.hasMention ?? room.hasMention,
      unreadCount: unreadRooms[room.id]?.count ?? room.unreadCount ?? 0,
      ...liveActivity(room),
    }));
  }, [directRooms, unreadRooms, liveActivity]);

  // Channels and DMs in one list, most recent first
  const allChats = React.useMemo(() => {
    const combined = [...groups, ...directMessages];
    return combined.sort((a, b) => {
      // Pinned chats first, most recently pinned on top; then by activity.
      const pinA = pinnedChats[a.id] ?? 0;
      const pinB = pinnedChats[b.id] ?? 0;
      if (pinA || pinB) return pinB - pinA;
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return timeB - timeA;
    });
  }, [groups, directMessages, pinnedChats]);

  // Filtered by tab and inline search
  // Archived chats live behind an "Arsip" row (search still finds them).
  const archivedChats = React.useMemo(() => allChats.filter((c) => archivedRooms[c.id]), [allChats, archivedRooms]);
  const archivedUnread = React.useMemo(
    () => archivedChats.filter((c) => c.hasUnread).length,
    [archivedChats],
  );
  React.useEffect(() => {
    if (showArchive && archivedChats.length === 0) setShowArchive(false);
  }, [showArchive, archivedChats.length]);

  const filteredChats = React.useMemo(() => {
    let list = searchQuery.trim()
      ? allChats
      : allChats.filter((c) => (showArchive ? archivedRooms[c.id] : !archivedRooms[c.id]));
    if (activeFolderTab === "channels") {
      list = list.filter((c) => c.isChannel);
    } else if (activeFolderTab === "dms") {
      list = list.filter((c) => !c.isChannel);
    }

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(q))
    );
  }, [allChats, activeFolderTab, searchQuery, showArchive, archivedRooms]);

  async function handleCreateRoom(participantId: string) {
    if (!user) {
      toast.error("Silakan login untuk memulai percakapan");
      return;
    }
    const response = await createRoom(user.id, participantId);
    if (response.status === "success" && response.data) {
      if (response.meta?.action === "existing") {
        toast("Percakapan ditemukan", {
          description: "Membuka obrolan...",
        });
      } else {
        toast.success("Percakapan baru berhasil dibuat!");
      }
      router.push(`/channels/${response.data.id}`);
    } else {
      toast.error(response.error?.message ?? "Gagal membuat percakapan");
    }
  }

  const renderLastMessage = (text?: string) => {
    if (!text) return null;
    const stripped = stripMarkdown(text);
    if (!stripped) return null;
    const html = stripped.replace(/:([a-zA-Z0-9_-]+):/g, (match, name) => {
      const emoji = customEmojis.find((e) => e.shortcode === name);
      return emoji
        ? `<img src="${emoji.url}" alt="${match}" class="inline-block h-[1.1em] w-[1.1em] align-text-bottom" />`
        : match;
    });
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const formatTime = (date?: Date) => {
    if (!date) return "";
    const d = new Date(date);
    const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const dayDiff = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);

    if (dayDiff <= 0) return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    if (dayDiff === 1) return "Kemarin";
    if (dayDiff < 7) return d.toLocaleDateString("id-ID", { weekday: "short" });
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  };

  if (!isMounted) {
    return (
      <Sidebar collapsible="none" className="border-none bg-transparent" {...props}>
        <div className="h-14" />
      </Sidebar>
    );
  }

  const tabs = [
    { id: "all" as const, label: "Semua" },
    { id: "channels" as const, label: "Channel" },
    { id: "dms" as const, label: "Pribadi" },
  ];

  return (
    <Sidebar
      collapsible="none"
      variant="sidebar"
      className={cn(
        "relative border-r border-sidebar-border bg-sidebar transition-none",
        isDefaultRoom ? "max-md:!w-full max-md:!max-w-full max-md:flex" : "max-md:hidden"
      )}
      {...props}
    >
      {/* Header: name of the list on the left, actions on the right. */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-4">
        <h2 className="text-[15px] font-semibold tracking-tight">Obrolan</h2>

        <div className="flex items-center gap-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                aria-label="Obrolan baru"
                title="Obrolan baru"
              >
                <PencilSimple className="size-[18px]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setOpenDMDialog(true)}>
                <User />
                Pesan langsung
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setOpenCreateChannel(true)}>
                <Hash />
                Buat channel
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setOpenExploreChannels(true)}>
                <Compass />
                Jelajahi channel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-1 flex size-8 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Akun"
              >
                {user ? (
                  <UserAvatar src={user.avatar} alt={user.name} className="size-7 rounded-full" />
                ) : (
                  <User className="size-[18px] text-muted-foreground" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {user ? (
                <>
                  <div className="px-2 py-1.5">
                    <p className="truncate text-sm font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push(`/profile/${user.username}`)}>
                    <User />
                    Profil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setOpenSaved(true)}>
                    <BookmarkSimple />
                    Pesan tersimpan
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/settings")}>
                    <GearSix />
                    Pengaturan
                  </DropdownMenuItem>
                  <ModeToggleItem />
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => router.push("/admin")}>
                      <SealCheck />
                      Panel admin
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={async () => {
                      await clientChatCache.clearAll();
                      await signOutUserAction();
                    }}
                  >
                    <SignOut />
                    Keluar
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onClick={() => router.push("/")}>
                  <User />
                  Masuk
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search: filters the list inline; Ctrl/⌘+K opens the full message search. */}
      <div className="shrink-0 px-3 pb-2">
        <div className="relative flex items-center">
          <MagnifyingGlass className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari"
            className="h-8 w-full rounded-md border border-sidebar-border bg-background pl-8 pr-16 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-1.5 flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              aria-label="Hapus pencarian"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setOpenGlobalSearch(true)}
              className="absolute right-1.5 hidden rounded opacity-80 hover:opacity-100 md:flex"
              title="Cari di semua pesan"
            >
              <Shortcut keys={["mod", "k"]} keyClassName="h-[18px] min-w-[18px] text-[10px] bg-sidebar" />
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex shrink-0 gap-4 border-b border-sidebar-border px-4" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeFolderTab === tab.id}
            onClick={() => setActiveFolderTab(tab.id)}
            className={cn(
              "-mb-px border-b-2 py-2 text-[13px] transition-colors",
              activeFolderTab === tab.id
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Chat list */}
      <SidebarContent
        className={cn(
          "overflow-x-hidden py-1.5",
          isMobile ? "pb-[calc(4rem+env(safe-area-inset-bottom))]" : "pb-4"
        )}
      >
        {!searchQuery.trim() && (showArchive || archivedChats.length > 0) && (
          <button
            type="button"
            onClick={() => setShowArchive((v) => !v)}
            className="mx-2 mb-1 flex w-[calc(100%-1rem)] items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-sidebar-accent/60"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
              {showArchive ? <CaretLeft className="size-4" /> : <Archive className="size-4 text-muted-foreground" />}
            </span>
            <span className="min-w-0 flex-1 font-medium">{showArchive ? "Kembali ke semua chat" : "Arsip"}</span>
            {!showArchive && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {archivedUnread > 0 ? `${archivedUnread} belum dibaca` : archivedChats.length}
              </span>
            )}
          </button>
        )}
        {filteredChats.length === 0 ? (
          <div className="px-4 py-10 text-sm text-muted-foreground">
            {searchQuery ? (
              <>
                <p>Tidak ada obrolan bernama &ldquo;{searchQuery}&rdquo;.</p>
                <button
                  type="button"
                  onClick={() => setOpenGlobalSearch(true)}
                  className="mt-2 text-foreground underline underline-offset-4"
                >
                  Cari di isi pesan
                </button>
              </>
            ) : (
              <>
                <p>Belum ada obrolan di sini.</p>
                <button
                  type="button"
                  onClick={() => setOpenDMDialog(true)}
                  className="mt-2 text-foreground underline underline-offset-4"
                >
                  Kirim pesan ke seseorang
                </button>
              </>
            )}
          </div>
        ) : (
          <ul className="flex flex-col">
            {filteredChats.map((chat) => {
              const isActive = pathname.startsWith(chat.url);
              const isOnline = !chat.isChannel && onlineUserIds.includes(chat.userId ?? "");
              return (
                <li key={chat.id}>
                  <ChatListItemMenu roomId={chat.id}>
                  <Link
                    href={chat.url}
                    prefetch={false}
                    onClick={(e) => {
                      if (isMobile) setOpenMobile(false);
                      // Plain clicks switch rooms on the client (no server
                      // render); modified clicks keep open-in-new-tab etc.
                      if (isPlainLeftClick(e)) {
                        e.preventDefault();
                        navigateToRoom(chat.url, router);
                      }
                    }}
                    onMouseEnter={() => prefetchRoom(chat.id)}
                    onFocus={() => prefetchRoom(chat.id)}
                    onTouchStart={() => prefetchRoom(chat.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "mx-2 flex select-none items-center gap-3 rounded-md px-2 py-2 transition-colors",
                      isActive ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60 active:bg-sidebar-accent"
                    )}
                  >
                    <div className="relative shrink-0">
                      <UserAvatar src={chat.avatar} alt={chat.name} className="size-10 rounded-full" />
                      {isOnline && (
                        <span
                          className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-sidebar"
                          aria-label="Online"
                        />
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={cn(
                            "flex min-w-0 items-center gap-1 truncate text-sm",
                            chat.hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground"
                          )}
                        >
                          {chat.isChannel && (
                            <Hash className="size-3.5 shrink-0 text-muted-foreground" aria-label="Channel" />
                          )}
                          <span className="truncate">{chat.name}</span>
                          {pinnedChats[chat.id] && (
                            <PushPin weight="fill" className="size-3 shrink-0 text-muted-foreground" aria-label="Disematkan" />
                          )}
                          {mutedRooms[chat.id] > Date.now() && (
                            <BellSlash className="size-3.5 shrink-0 text-muted-foreground" aria-label="Dibisukan" />
                          )}
                        </span>
                        {chat.lastMessageTime && (
                          <span
                            className={cn(
                              "shrink-0 text-[11px] tabular-nums",
                              chat.hasUnread ? "text-foreground" : "text-muted-foreground"
                            )}
                          >
                            {formatTime(chat.lastMessageTime)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-[13px]",
                            chat.hasUnread ? "text-foreground/80" : "text-muted-foreground"
                          )}
                        >
                          {roomTyping[chat.id] ? (
                            <span className="text-primary" aria-live="polite">
                              {chat.isChannel ? `${roomTyping[chat.id].name} sedang mengetik…` : "sedang mengetik…"}
                            </span>
                          ) : chat.lastMessage ? (
                            renderLastMessage(chat.lastMessage)
                          ) : (
                            "Belum ada pesan"
                          )}
                        </span>

                        {chat.hasUnread && (
                          <span className="flex shrink-0 items-center gap-1">
                            {chat.hasMention && (
                              <span
                                className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground"
                                aria-label="Kamu disebut"
                              >
                                @
                              </span>
                            )}
                            <span
                              className={cn(
                                "flex items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                                // Marked unread by hand: a dot, no number.
                                chat.unreadCount > 0 ? "h-[18px] min-w-[18px] px-1.5" : "size-2.5",
                                // Muted rooms keep their count, in grey.
                                mutedRooms[chat.id] > Date.now() && !chat.hasMention
                                  ? "bg-muted-foreground/30 text-foreground/80"
                                  : "bg-primary text-primary-foreground"
                              )}
                              aria-label={chat.unreadCount > 0 ? `${chat.unreadCount} pesan belum dibaca` : "Ditandai belum dibaca"}
                            >
                              {chat.unreadCount > 99 ? "99+" : chat.unreadCount > 0 ? chat.unreadCount : ""}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                  </ChatListItemMenu>
                </li>
              );
            })}
          </ul>
        )}
      </SidebarContent>

      {/* Dialogs */}
      <CreateChannelDialog
        open={openCreateChannel}
        onOpenChange={setOpenCreateChannel}
        userId={user?.id || ""}
      />
      <ExploreChannelsDialog
        open={openExploreChannels}
        onOpenChange={setOpenExploreChannels}
        userId={user?.id || ""}
      />
      <SearchUserDialog
        open={openSearchUser}
        onOpenChange={setOpenSearchUser}
        userId={user?.id || ""}
      />
      <DirectMessageDialog
        open={openDMDialog}
        onOpenChange={setOpenDMDialog}
        onSelectUser={async (userId) => {
          await handleCreateRoom(userId);
          setOpenDMDialog(false);
          if (isMobile) setOpenMobile(false);
        }}
        user={
          user ?? {
            id: "",
            name: "",
            initial: "",
            role: "",
            email: "",
            avatar: "",
          }
        }
      />
      <SavedMessagesDialog
        open={openSaved}
        onOpenChange={setOpenSaved}
        onSelect={(roomId, messageId) =>
          navigateToRoom(`/channels/${roomId}?messageId=${encodeURIComponent(messageId)}`, router)
        }
      />
      <MessageSearch
        isOpen={openGlobalSearch}
        onOpenChange={setOpenGlobalSearch}
        onSelectMessage={(messageId, roomId) => {
          if (roomId) {
            navigateToRoom(`/channels/${roomId}?messageId=${encodeURIComponent(messageId)}`, router);
          }
        }}
      />
    </Sidebar>
  );
}
