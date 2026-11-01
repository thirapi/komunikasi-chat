"use client";

import { roomChannel } from "@/lib/pusher/channels";
import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { debounce } from "@/lib/debounce";
import { getPusher } from "@/lib/pusher/pusher.client";
import { getMessage, updateLastReadAt, editMessageAction, toggleReactionAction } from "../messages.action";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createId } from "@paralleldrive/cuid2";

import { MessageWithUserDTO } from "@/lib/entities/models/message.model";
import { RoomWithParticipantsDTO } from "@/lib/entities/models/room.model";

import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { ChatHeader } from "./chat-header";
import { MemberList } from "./member-list";
import { MobileMemberList } from "./mobile-member-list";
import { MessageSearch } from "@/components/message-search";
import { useScrollToInitial } from "./hooks/use-scroll-to-initial";
import { useAutoScroll } from "./hooks/use-auto-scroll";
import { useAutoFocusInput } from "./hooks/use-auto-focus-input";
import { useMarkAsRead } from "./hooks/use-mark-as-read";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePresence } from "@/components/presence-provider";
import { useUnread } from "@/components/unread-provider";
import { ArrowDown, Paperclip } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { stripMarkdown } from "@/lib/strip-markdown";
import { retrySend, clearRetry } from "@/lib/chat/pending-sends";
import { messagePreview } from "@/lib/chat/message-preview";

/**
 * Ceiling on how many messages stay mounted at once. Pagination still works
 * past this point because `loadMoreMessages` pages from the oldest *mounted*
 * message, so trimming older rows does not strand the user at the top.
 */
const MAX_MOUNTED_MESSAGES = 500;

/**
 * Where the reader was in each room, so coming back restores the exact spot
 * (Telegram-style) instead of jumping to the bottom or the unread marker.
 * `null` means "was at the bottom". Kept in memory for the session only.
 */
const roomScrollMemory = new Map<string, { anchorId: string; offset: number } | null>();

interface ChatRoomProps {
  userId: string;
  roomData: RoomWithParticipantsDTO;
  initialMessages: MessageWithUserDTO[];
  lastReadMessageId: string | null;
  lastReadAt: Date | null;
  user: {
    id: string;
    name: string;
    username: string;
    avatar: string;
  };
}

export function ChatRoom({
  userId,
  roomData,
  initialMessages,
  lastReadMessageId,
  lastReadAt,
  user,
}: ChatRoomProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [localRoomData, setLocalRoomData] = useState(roomData);
  const { onlineUserIds } = usePresence();
  const [missedCount, setMissedCount] = useState(0);
  const [canShowJump, setCanShowJump] = useState(false);
  const { markAsRead: markSidebarAsRead, recordActivity } = useUnread();
  const [showMembers, setShowMembers] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<MessageWithUserDTO | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(false);
  // >= rather than ===: a room opened from cache can hand down more than one
  // page, and that still means older history may exist on the server.
  const [hasMore, setHasMore] = useState(initialMessages.length >= 50);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastReadIdState, setLastReadIdState] = useState<string | null>(
    lastReadMessageId,
  );
  const [lastReadAtState, setLastReadAtState] = useState<Date | null>(
    lastReadAt,
  );
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const isMobile = useIsMobile();
  const router = useRouter();

  const messagesRef = useRef(messages);
  const isAtBottomRef = useRef(isAtBottom);
  isAtBottomRef.current = isAtBottom;
  const lastPersistedReadIdRef = useRef<string | null>(lastReadMessageId);
  const isInitialLoadRef = useRef(true);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const unreadRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  // Drag-and-drop: files dropped anywhere on the conversation go to the
  // composer. A depth counter avoids flicker as the drag crosses child nodes.
  const fileDropRef = useRef<((files: File[]) => void) | null>(null);
  const dragDepthRef = useRef(0);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
  const dropHandlers = {
    onDragEnter: (e: React.DragEvent) => {
      if (!hasFiles(e) || !fileDropRef.current) return;
      e.preventDefault();
      dragDepthRef.current += 1;
      setIsDraggingFiles(true);
    },
    onDragOver: (e: React.DragEvent) => {
      if (!hasFiles(e) || !fileDropRef.current) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setIsDraggingFiles(false);
    },
    onDrop: (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepthRef.current = 0;
      setIsDraggingFiles(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) fileDropRef.current?.(files);
    },
  };

  // Sync state with props when they change (e.g. after server fetch in wrapper)
  useEffect(() => {
    // HARDENING: Only sync from props if the incoming data is newer than what we have locally.
    // This prevents stale server responses from overwriting rapid local read-state updates.
    if (lastReadAt) {
      const incomingAt = new Date(lastReadAt);
      if (!lastReadAtState || incomingAt > lastReadAtState) {
        setLastReadIdState(lastReadMessageId);
        setLastReadAtState(incomingAt);
        lastPersistedReadIdRef.current = lastReadMessageId;
      }
    } else if (!lastReadAtState && lastReadMessageId) {
      // Handle case where we have an ID but no timestamp yet (legacy or edge case)
      setLastReadIdState(lastReadMessageId);
      lastPersistedReadIdRef.current = lastReadMessageId;
    }
  }, [lastReadMessageId, lastReadAt]);

  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revealMessage = useCallback((messageId: string, behavior: ScrollBehavior = "smooth") => {
    const element = document.getElementById(`message-${messageId}`);
    if (!element) return false;
    element.scrollIntoView({ behavior, block: "center" });
    setHighlightedMessageId(messageId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedMessageId(null), 2000);
    return true;
  }, []);

  /**
   * Jump to any message — a reply's original, a search hit, a deep link. If it
   * is not mounted yet, page older history in (up to the mount ceiling) until
   * it is, then scroll to it.
   */
  const scrollToMessage = useCallback(async (messageId: string) => {
    if (revealMessage(messageId)) return;

    const toastId = toast.loading("Mencari pesan…");
    try {
      let pool = messagesRef.current;
      const older: MessageWithUserDTO[] = [];
      for (let page = 0; page < 8; page++) {
        const oldest = older[0] ?? pool[0];
        if (!oldest) break;
        if (pool.length + older.length >= MAX_MOUNTED_MESSAGES) break;
        const res = await getMessage(roomData.id, 50, new Date(oldest.createdAt));
        if (res.status !== "success" || !res.data || res.data.length === 0) {
          setHasMore(false);
          break;
        }
        older.unshift(...res.data);
        if (res.data.length < 50) setHasMore(false);
        if (res.data.some((m) => m.id === messageId)) break;
      }

      if (!older.some((m) => m.id === messageId)) {
        toast.error("Pesan tidak ditemukan — mungkin sudah dihapus", { id: toastId });
        return;
      }

      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !ids.has(m.id)), ...prev];
      });
      toast.dismiss(toastId);
      // Two frames: one for React to commit the prepended rows, one for layout.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => revealMessage(messageId)),
      );
    } catch {
      toast.error("Gagal memuat pesan", { id: toastId });
    }
  }, [revealMessage, roomData.id]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Reconciliation backstop for IndexedDB. Incremental appends are already
  // persisted by mergeMessages in handleNewMessage, so this is debounced to
  // collapse bursts (and "load more" prepending) into a single write instead
  // of a full-table rewrite on every single message.
  useEffect(() => {
    const timer = setTimeout(() => {
      import("@/lib/infrastructure/cache/client-cache").then((m) => {
        const persistedMsgs = messages.filter(msg => !msg.isOptimistic);
        m.clientChatCache.setMessages(localRoomData.id, persistedMsgs);
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [messages, localRoomData.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      isInitialLoadRef.current = false;
      setCanShowJump(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (initialMessages.length === 0) return;
    // The wrapper hands down a fresh server snapshot after its background
    // fetch. Replacing state wholesale used to drop anything that arrived
    // while that fetch was in flight (Pusher messages, the user's own
    // optimistic sends), so keep those on top of the snapshot instead.
    setMessages((prev) => {
      if (prev === initialMessages) return prev;
      const ids = new Set(initialMessages.map((m) => m.id));
      const optimisticIds = new Set(
        initialMessages.map((m) => m.optimisticId).filter(Boolean),
      );
      const newest = new Date(
        initialMessages[initialMessages.length - 1].createdAt,
      ).getTime();
      const oldest = new Date(initialMessages[0].createdAt).getTime();
      const newer = prev.filter(
        (m) =>
          !ids.has(m.id) &&
          !(m.optimisticId && optimisticIds.has(m.optimisticId)) &&
          (m.isOptimistic || new Date(m.createdAt).getTime() > newest),
      );
      // History older than the snapshot (from cache or paging) is kept, so a
      // reader scrolled up in a cached room does not see it vanish under them.
      // Anything inside the snapshot's time range but missing from it was
      // deleted while we were away, so it is dropped.
      const olderRows = prev.filter(
        (m) => !m.isOptimistic && !ids.has(m.id) && new Date(m.createdAt).getTime() < oldest,
      );
      if (newer.length === 0 && olderRows.length === 0) return initialMessages;
      return [...olderRows, ...initialMessages, ...newer].slice(-MAX_MOUNTED_MESSAGES);
    });
  }, [initialMessages]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Ctrl/⌘+F searches this room; Ctrl/⌘+K stays the global search owned
      // by the sidebar, so the two never compete for the same keys.
      if (e.key.toLowerCase() === "f" && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        setIsSearchOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const sendNotification = useCallback(
    (msg: MessageWithUserDTO) => {
      try {
        const audio = new Audio("/sounds/message-notification.mp3");
        audio.play().catch((e) => console.warn("Audio play failed", e));
      } catch (e) {
        console.warn("Audio context failed", e);
      }

      const resolveContentForNotification = (raw: string) => {
        return raw.replace(/<@([a-zA-Z0-9_-]+)>/g, (match, uid) => {
          if (uid === "everyone") return "@everyone";
          if (uid === userId) return `@${user.username}`;
          const participant = localRoomData.participants?.find((p: any) => p.user.id === uid);
          return participant ? `@${participant.user.username}` : match;
        });
      };

      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted" &&
        !document.hasFocus()
      ) {
        const sender = msg.user?.name || msg.user?.username || "Seseorang";
        new Notification(
          roomData.isDirect ? sender : `${sender} · #${roomData.name}`,
          {
            body: stripMarkdown(resolveContentForNotification(msg.content || "")) || "Mengirim lampiran",
            icon: msg.user?.avatar || "/favicon.ico",
            tag: `msg-${roomData.id}`,
            silent: true,
          },
        );
      }
    },
    [roomData.name, roomData.id, roomData.isDirect, userId, user.username, localRoomData.participants],
  );

  const markAsReadApi = useMemo(
    () =>
      debounce(async (messageId?: string) => {
        if (!userId || userId === "" || userId === "null") return;

        // If no messageId provided, use the last message in the list
        let targetId = messageId || messagesRef.current[messagesRef.current.length - 1]?.id;

        if (!targetId || targetId === lastPersistedReadIdRef.current)
          return;

        // Find the message index
        let currentIndex = messagesRef.current.findIndex(m => m.id === targetId);
        if (currentIndex === -1) return;

        // HARDENING: If target message is optimistic, we CANNOT send it to server (FK violation)
        // Find the latest REAL message at or before this index
        let targetMsg = messagesRef.current[currentIndex];
        if (targetMsg.isOptimistic || targetId.startsWith('optimistic-')) {
          const lastRealMsgIndex = messagesRef.current.slice(0, currentIndex + 1).findLastIndex(m => !m.isOptimistic && !m.id.startsWith('optimistic-'));
          if (lastRealMsgIndex === -1) return; // No real messages to mark as read yet

          currentIndex = lastRealMsgIndex;
          targetMsg = messagesRef.current[currentIndex];
          targetId = targetMsg.id;

          // Check again if this real message was already persisted
          if (targetId === lastPersistedReadIdRef.current) return;
        }

        const prevIndex = lastPersistedReadIdRef.current
          ? messagesRef.current.findIndex(m => m.id === lastPersistedReadIdRef.current)
          : -1;

        if (prevIndex !== -1 && currentIndex <= prevIndex) return;

        // Find the message's createdAt to use as the precision timestamp
        const targetAt = new Date(targetMsg.createdAt);

        // Update local state and persisted ref
        setLastReadIdState(targetId);
        setLastReadAtState(targetAt);
        lastPersistedReadIdRef.current = targetId;

        // Sync to sidebar and cache
        markSidebarAsRead(roomData.id);
        import("@/lib/infrastructure/cache/client-cache").then((m) => {
          m.clientChatCache.setLastRead(roomData.id, targetId, targetAt);
        });

        // Server update
        updateLastReadAt(userId, roomData.id, targetId, targetAt).catch(err => {
          console.error("Failed to update last read at server:", err);
        });
      }, 500),
    [userId, roomData.id, markSidebarAsRead],
  );

  // Messages only count as read while the user can actually see them. In a
  // background tab or unfocused window the read is deferred until they return,
  // so the room stays unread (sidebar dot, tab title) like Slack/Telegram.
  const pendingReadRef = useRef<string | true | null>(null);
  const markAsRead = useCallback((messageId?: string) => {
    if (!userId || userId === "") return;
    if (document.visibilityState !== "visible" || !document.hasFocus()) {
      pendingReadRef.current = messageId ?? true;
      return;
    }
    markAsReadApi(messageId);
  }, [markAsReadApi, userId]);

  useEffect(() => {
    const flushPending = () => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;
      const pending = pendingReadRef.current;
      if (pending === null) return;
      pendingReadRef.current = null;
      // Only messages that are on screen count: at the bottom, everything;
      // otherwise the specific message the viewport observer reported.
      if (isAtBottomRef.current) markAsReadApi();
      else if (typeof pending === "string") markAsReadApi(pending);
    };
    window.addEventListener("focus", flushPending);
    document.addEventListener("visibilitychange", flushPending);
    return () => {
      window.removeEventListener("focus", flushPending);
      document.removeEventListener("visibilitychange", flushPending);
    };
  }, [markAsReadApi]);

  const handleNewMessage = useCallback(
    (msg: MessageWithUserDTO, isFromSync = false) => {
      if (msg.userId !== userId && !isFromSync && !isInitialLoadRef.current) {
        sendNotification(msg);
      }

      // Keep this room's sidebar preview/time live (own sends included).
      recordActivity(localRoomData.id, messagePreview(msg, { id: userId, username: user.username }), msg.createdAt);

      // If the message is from the current user, treat it as read automatically
      if (msg.userId === userId) {
        setLastReadIdState(msg.id);
        const at = new Date(msg.createdAt);
        setLastReadAtState(at);

        // Sync to cache immediately for current user's messages
        import("@/lib/infrastructure/cache/client-cache").then((m) => {
          m.clientChatCache.setLastRead(localRoomData.id, msg.id, at);
        });

        // Update the persisted ref to avoid redundant or out-of-order updates
        lastPersistedReadIdRef.current = msg.id;

        // HARDENING: If this is a real message (not optimistic), also update server
        if (!msg.isOptimistic && !msg.id.startsWith('optimistic-')) {
          updateLastReadAt(userId, localRoomData.id, msg.id, at).catch(console.error);
        }
      } else if (isAtBottomRef.current && !isFromSync) {
        // If we receive a message and we're already at the bottom, mark it as read
        markAsRead(msg.id);
      } else if (!isAtBottomRef.current && !isFromSync && !messagesRef.current.some((m) => m.id === msg.id)) {
        setMissedCount((n) => n + 1);
      }

      setMessages((prev) => {
        const existingIndex = prev.findIndex((m) => {
          // 1. Direct ID match (for server-pushed updates of existing messages)
          if (m.id === msg.id) return true;

          // 2. Optimistic ID match (for replacing the placeholder with the real server message)
          if (msg.optimisticId && m.optimisticId === msg.optimisticId) return true;

          return false;
        });

        let nextMessages: MessageWithUserDTO[];
        if (existingIndex > -1) {
          nextMessages = [...prev];
          nextMessages[existingIndex] = { ...msg, isOptimistic: false };
        } else {
          // Keep the append path bounded too, so a long-lived tab cannot grow
          // the mounted list without limit either.
          nextMessages = [...prev, msg].slice(-MAX_MOUNTED_MESSAGES);
        }

        if (!msg.isOptimistic) {
          import("@/lib/infrastructure/cache/client-cache").then((m) => {
            m.clientChatCache.mergeMessages(localRoomData.id, [msg]);
          });
        }

        return nextMessages;
      });
    },
    // isAtBottom is read through a ref: as a dependency it rebuilt this
    // callback on every scroll past the bottom edge, which in turn tore down
    // and re-subscribed the Pusher channel below — events landing in that gap
    // were dropped until the next focus/reconnect sync.
    [userId, user.username, localRoomData.id, sendNotification, markAsRead, recordActivity],
  );

  // Ensure read state is flushed on unmount/visibility hidden
  useEffect(() => {
    const flushReadState = async () => {
      let lastReadId = lastPersistedReadIdRef.current;
      if (lastReadId) {
        // Find the message in current ref to get its timestamp if possible
        let msg = messagesRef.current.find(m => m.id === lastReadId);

        // HARDENING: If the last tracked ID is optimistic, find the latest real one before it
        if (!msg || msg.isOptimistic || lastReadId.startsWith('optimistic-')) {
          const lastRealMsg = messagesRef.current.findLast(m => !m.isOptimistic && !m.id.startsWith('optimistic-'));
          if (lastRealMsg) {
            msg = lastRealMsg;
            lastReadId = msg.id;
          } else {
            return; // No real messages to mark as read
          }
        }

        const at = msg ? new Date(msg.createdAt) : undefined;

        if (!userId || userId === "" || userId === "null") return;

        markSidebarAsRead(roomData.id);
        updateLastReadAt(userId, roomData.id, lastReadId, at).catch(console.error);

        // Also update cache on flush
        import("@/lib/infrastructure/cache/client-cache").then((m) => {
          m.clientChatCache.setLastRead(roomData.id, lastReadId, at);
        });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushReadState();
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      flushReadState(); // Flush on unmount
    };
  }, [userId, roomData.id, markSidebarAsRead]);

  const syncInFlightRef = useRef(false);
  const lastSyncAtRef = useRef(0);

  /**
   * Catch up on anything missed while the socket was down or the tab was in
   * the background. Several triggers (reconnect, focus, visibility, online)
   * often fire together, so concurrent and back-to-back calls are collapsed.
   */
  const syncMessages = useCallback(async () => {
    if (syncInFlightRef.current || Date.now() - lastSyncAtRef.current < 1500) return;
    const currentMessages = messagesRef.current.filter((m) => !m.isOptimistic);
    if (currentMessages.length === 0) return;

    syncInFlightRef.current = true;
    try {
      const lastMessage = currentMessages[currentMessages.length - 1];
      const afterDate = new Date(lastMessage.createdAt);

      const response = await getMessage(roomData.id, 50, undefined, afterDate);
      if (response.status === "success" && response.data) {
        response.data.forEach((msg) => handleNewMessage(msg, true));
      }
    } finally {
      lastSyncAtRef.current = Date.now();
      syncInFlightRef.current = false;
    }
  }, [roomData.id, handleNewMessage]);

  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    const viewport = viewportRef.current;
    const previousScrollHeight = viewport?.scrollHeight ?? 0;

    setIsLoadingMore(true);
    const oldestMessage = messages[0];
    const beforeDate = oldestMessage
      ? new Date(oldestMessage.createdAt)
      : undefined;

    const response = await getMessage(roomData.id, 50, beforeDate);
    if (response.status === "success" && response.data) {
      if (response.data.length < 50) setHasMore(false);
      setMessages((prev) => {
        const prevIds = new Set(prev.map(m => m.id));
        const nonDuplicates = response.data!.filter(m => !prevIds.has(m.id));
        // Bound the mounted window. Every extra page prepends another 50 rows
        // with no ceiling, so scrolling up repeatedly used to grow the list
        // without limit and mount one MessageItem per row.
        //
        // A hard windowing library was deliberately not used here: the chat
        // viewport relies on `flex-col-reverse` so the browser anchors the
        // newest message at scrollTop 0 with no JS measurement
        // (docs/column-reverse-architecture.md). A virtualiser would need
        // absolute positioning plus JS scroll math, reintroducing the
        // scroll-flash that architecture exists to avoid.
        return [...nonDuplicates, ...prev].slice(-MAX_MOUNTED_MESSAGES);
      });
    }
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore, messages, roomData.id]);

  useEffect(() => {
    if (isAtBottom) setMissedCount(0);
  }, [isAtBottom]);

  const jumpToLatest = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  // Restore this room's last reading position before the first paint.
  const restoredScrollRef = useRef(false);
  const skipInitialScrollRef = useRef(roomScrollMemory.get(roomData.id) != null);
  useLayoutEffect(() => {
    if (restoredScrollRef.current) return;
    const saved = roomScrollMemory.get(roomData.id);
    const viewport = viewportRef.current;
    if (!saved || !viewport || messages.length === 0) return;
    restoredScrollRef.current = true;
    const el = document.getElementById(`message-${saved.anchorId}`);
    if (!el) {
      skipInitialScrollRef.current = false;
      return;
    }
    const delta = el.getBoundingClientRect().top - viewport.getBoundingClientRect().top - saved.offset;
    viewport.scrollTop += delta;
  }, [messages.length, roomData.id]);

  // Remember the reading position when leaving the room.
  useLayoutEffect(() => {
    const roomId = roomData.id;
    return () => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      // flex-col-reverse: scrollTop is 0 at the bottom and negative above it.
      if (Math.abs(viewport.scrollTop) < 40) {
        roomScrollMemory.set(roomId, null);
        return;
      }
      const top = viewport.getBoundingClientRect().top;
      const rows = viewport.querySelectorAll<HTMLElement>("[data-message-id]");
      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        if (rect.bottom > top) {
          roomScrollMemory.set(roomId, {
            anchorId: row.dataset.messageId!,
            offset: rect.top - top,
          });
          return;
        }
      }
    };
  }, [roomData.id]);

  // Deep link (?messageId=...) from global search.
  const searchParams = useSearchParams();
  const deepLinkId = searchParams.get("messageId");
  const handledDeepLinkRef = useRef<string | null>(null);
  useEffect(() => {
    if (!deepLinkId || handledDeepLinkRef.current === deepLinkId || messages.length === 0) return;
    handledDeepLinkRef.current = deepLinkId;
    skipInitialScrollRef.current = true;
    const t = setTimeout(() => {
      scrollToMessage(deepLinkId);
      window.history.replaceState(null, "", window.location.pathname);
    }, 50);
    return () => clearTimeout(t);
  }, [deepLinkId, messages.length, scrollToMessage]);

  useScrollToInitial(messages, unreadRef, bottomRef, skipInitialScrollRef);
  useAutoScroll(messages, userId, isAtBottom, bottomRef);
  useAutoFocusInput(inputRef);
  useMarkAsRead(bottomRef, viewportRef, setIsAtBottom, markAsRead);

  useEffect(() => {
    if (!isMobile) {
      setShowMembers(true);
    } else {
      setShowMembers(false);
    }
  }, [isMobile]);

  useEffect(() => {
    const chatChannel = getPusher().subscribe(roomChannel(roomData.id));
    chatChannel.bind("new-message", (msg: MessageWithUserDTO) =>
      handleNewMessage(msg),
    );
    chatChannel.bind("message-updated", (updatedMsg: MessageWithUserDTO) => {
      setMessages((prev) => prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)));
    });
    chatChannel.bind("message-reaction", ({ messageId, action, reaction }: any) => {
      setMessages((prev) => prev.map((m) => {
        if (m.id !== messageId) return m;

        const currentReactions = m.reactions || [];
        let nextReactions;

        if (action === "added") {
          // 1. Purge any optimistic entry for the same userId+emoji to prevent duplicates
          const withoutOptimistic = currentReactions.filter(
            (r) => !(
              r.id.startsWith('optimistic-') &&
              r.userId === reaction.userId &&
              r.emoji === reaction.emoji
            )
          );
          // 2. Only append the real entry if it isn't already present
          const alreadyExists = withoutOptimistic.some((r) => r.id === reaction.id);
          nextReactions = alreadyExists ? withoutOptimistic : [...withoutOptimistic, reaction];
        } else {
          // Remove by real ID and also purge any lingering optimistic entry for same userId+emoji
          nextReactions = currentReactions.filter(
            (r) => r.id !== reaction.id &&
              !(
                r.id.startsWith('optimistic-') &&
                r.userId === reaction.userId &&
                r.emoji === reaction.emoji
              )
          );
        }

        return { ...m, reactions: nextReactions };
      }));
    });
    chatChannel.bind("message-deleted", ({ messageId }: { messageId: string }) => {
      setMessages((prev) => {
        const deletedIndex = prev.findIndex((m) => m.id === messageId);
        if (deletedIndex === -1) return prev;

        // If the deleted message is our current "last read" anchor, pick a new one.
        // We pick the message immediately BEFORE it to maintain the read position.
        if (messageId === lastPersistedReadIdRef.current) {
          const newAnchorMsg = prev[deletedIndex - 1];
          const newAnchorId = newAnchorMsg?.id || null;
          const newAnchorAt = newAnchorMsg ? new Date(newAnchorMsg.createdAt) : null;

          setLastReadIdState(newAnchorId);
          setLastReadAtState(newAnchorAt);
          lastPersistedReadIdRef.current = newAnchorId;

          // Also update cache and server
          import("@/lib/infrastructure/cache/client-cache").then((m) => {
            m.clientChatCache.setLastRead(roomData.id, newAnchorId, newAnchorAt);
          });

          if (newAnchorId && newAnchorAt) {
            updateLastReadAt(userId, roomData.id, newAnchorId, newAnchorAt).catch(console.error);
          }
        }

        return prev.filter((m) => m.id !== messageId);
      });

      import("@/lib/infrastructure/cache/client-cache").then((m) => {
        m.clientChatCache.removeMessage(roomData.id, messageId);
      });
    });
    const handleConnected = () => syncMessages();
    getPusher().connection.bind("connected", handleConnected);
    const handleFocus = () => syncMessages();
    const handleVisible = () => {
      if (document.visibilityState === "visible") syncMessages();
    };
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleFocus);
    document.addEventListener("visibilitychange", handleVisible);

    return () => {
      chatChannel.unbind_all();
      chatChannel.unsubscribe();
      getPusher().connection.unbind("connected", handleConnected);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleFocus);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [roomData.id, handleNewMessage, syncMessages]);

  const handleMessageSend = useCallback(
    (msg: MessageWithUserDTO) => {
      handleNewMessage(msg);
      markAsRead();
    },
    [handleNewMessage, markAsRead],
  );

  const handleSendFailed = useCallback((optimisticId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.isOptimistic && m.optimisticId === optimisticId ? { ...m, sendError: true } : m,
      ),
    );
  }, []);

  const handleUploadProgress = useCallback((optimisticId: string, pct: number) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.isOptimistic && m.optimisticId === optimisticId && m.uploadProgress !== pct
          ? { ...m, uploadProgress: pct }
          : m,
      ),
    );
  }, []);

  const handleRetrySend = useCallback((message: MessageWithUserDTO) => {
    if (!message.optimisticId) return;
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, sendError: false } : m)));
    if (!retrySend(message.optimisticId)) {
      toast.error("Pesan ini tidak bisa dikirim ulang");
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, sendError: true } : m)));
    }
  }, []);

  const handleDiscardSend = useCallback((message: MessageWithUserDTO) => {
    if (message.optimisticId) clearRetry(message.optimisticId);
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  const handleReply = useCallback((message: MessageWithUserDTO) => {
    setReplyingTo(message);
    // Put the caret in the composer so the user can type the answer straight away.
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handleStartEdit = useCallback((message: MessageWithUserDTO) => {
    setEditingMessageId(message.id);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null);
  }, []);

  const handleToggleMembers = useCallback(() => {
    setShowMembers((prev) => !prev);
  }, []);

  const handleUpdateRoom = useCallback((data: Partial<RoomWithParticipantsDTO>) => {
    setLocalRoomData((prev) => ({ ...prev, ...data }));
  }, []);

  const handleSaveEdit = useCallback(async (messageId: string, content: string) => {
    const response = await editMessageAction(userId, messageId, content);
    if (response.status === "success" && response.data) {
      setMessages((prev) => prev.map((m) => (m.id === response.data!.id ? response.data! : m)));
      setEditingMessageId(null);
    } else {
      toast.error(response.error?.message || "Gagal mengedit pesan");
    }
  }, [userId]);

  const handleStartEditLast = useCallback(() => {
    const userMessages = messages.filter((m) => m.userId === userId && !m.isOptimistic);
    if (userMessages.length > 0) {
      const lastMsg = userMessages[userMessages.length - 1];
      setEditingMessageId(lastMsg.id);
    }
  }, [messages, userId]);

  const handleToggleReaction = useCallback(async (messageId: string, emoji: string) => {
    // 1. Find message and current reaction status
    const message = messagesRef.current.find(m => m.id === messageId);
    if (!message) return;

    const existingReaction = (message.reactions || []).find(
      r => r.userId === userId && r.emoji === emoji
    );

    // 2. Prepare Optimistic Update
    const action = existingReaction ? "removed" : "added";

    setMessages((prev) => prev.map((m) => {
      if (m.id !== messageId) return m;

      const currentReactions = m.reactions || [];
      let nextReactions;

      if (action === "added") {
        nextReactions = [
          ...currentReactions,
          {
            id: `optimistic-${createId()}`,
            messageId,
            userId,
            emoji,
            createdAt: new Date(),
            updatedAt: new Date(),
            user: { username: user.username }
          }
        ];
      } else {
        nextReactions = currentReactions.filter((r) => !(r.userId === userId && r.emoji === emoji));
      }

      return { ...m, reactions: nextReactions };
    }));

    // 3. Call Server Action
    const response = await toggleReactionAction(userId, messageId, emoji);

    if (response.status === "error") {
      toast.error(response.error?.message || "Gagal memberikan reaksi");

      // Rollback on error
      setMessages((prev) => prev.map((m) => {
        if (m.id !== messageId) return m;
        return { ...m, reactions: message.reactions };
      }));
    }
  }, [userId, user.username]);

  return (
    <div className="flex flex-col h-full min-h-0 w-full overflow-hidden bg-background">
      <ChatHeader
        roomData={localRoomData}
        currentUserId={userId}
        onToggleMembers={handleToggleMembers}
        onToggleSearch={() => setIsSearchOpen(true)}
        membersVisible={showMembers}
        onlineUserIds={onlineUserIds}
        onUpdateRoom={handleUpdateRoom}
      />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="relative flex flex-col flex-1 min-h-0 overflow-hidden" {...dropHandlers}>
          {isDraggingFiles && (
            <div className="pointer-events-none absolute inset-2 z-30 flex items-center justify-center rounded-xl border-2 border-dashed border-primary/60 bg-background/85 backdrop-blur-[2px] animate-in fade-in duration-100">
              <div className="text-center">
                <Paperclip className="mx-auto h-7 w-7 text-primary" />
                <p className="mt-2 text-sm font-semibold text-foreground">Lepaskan untuk melampirkan</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Foto, video, atau dokumen · maksimal 5 file, 50 MB per file</p>
              </div>
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-hidden relative">
            <MessageList
              userId={userId}
              messages={messages}
              bottomRef={bottomRef}
              unreadRef={unreadRef}
              onlineUserIds={onlineUserIds}
              onReply={handleReply}
              onStartEdit={handleStartEdit}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              onToggleReaction={handleToggleReaction}
              editingMessageId={editingMessageId}
              lastReadMessageId={lastReadIdState}
              lastReadAt={lastReadAtState}
              onLoadMore={loadMoreMessages}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              viewportRef={viewportRef}
              roomData={localRoomData}
              highlightedMessageId={highlightedMessageId}
              onScrollToMessage={scrollToMessage}
              onRetrySend={handleRetrySend}
              onDiscardSend={handleDiscardSend}
            />
            {canShowJump && !isAtBottom && (
              <button
                type="button"
                onClick={jumpToLatest}
                className={cn(
                  "absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 h-8 pl-3 pr-3.5 rounded-full border text-xs font-medium shadow-md animate-in fade-in slide-in-from-bottom-2 duration-150",
                  missedCount > 0
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-popover text-foreground border-border hover:bg-muted"
                )}
              >
                <ArrowDown weight="bold" className="h-3.5 w-3.5" />
                {missedCount > 0
                  ? `${missedCount > 99 ? "99+" : missedCount} pesan baru`
                  : "Ke pesan terbaru"}
              </button>
            )}
          </div>
          <MessageInput
            userId={userId}
            roomData={roomData}
            replyingTo={replyingTo}
            onCancelReply={handleCancelReply}
            inputRef={inputRef}
            onNewMessage={handleMessageSend}
            onStartEditLast={handleStartEditLast}
            onSendFailed={handleSendFailed}
            onUploadProgress={handleUploadProgress}
            fileDropRef={fileDropRef}
            user={user}
          />
        </div>
        {showMembers && !isMobile && (
          <MemberList
            roomData={roomData}
            onlineUserIds={onlineUserIds}
            currentUserId={userId}
          />
        )}
      </div>
      <MobileMemberList
        roomData={roomData}
        onlineUserIds={onlineUserIds}
        isOpen={showMembers && !!isMobile}
        onClose={() => setShowMembers(false)}
        currentUserId={userId}
      />
      <MessageSearch
        isOpen={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        roomId={localRoomData.id}
        onSelectMessage={scrollToMessage}
      />
    </div>
  );
}
