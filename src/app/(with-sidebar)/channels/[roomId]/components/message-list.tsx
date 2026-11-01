// src/app/(with-sidebar)/channels/[roomId]/components/message-list.tsx
import {
  MessageRecord,
  MessageWithUserDTO,
} from "@/lib/entities/models/message.model";
import { MessageItem } from "./message-item";
import { Hash, CircleNotch } from "@phosphor-icons/react/dist/ssr";
import { UserAvatar } from "@/components/ui/user-avatar";
import { DateSeparator } from "./date-separator";
import { UnreadSeparator } from "./unread-separator";
import { DateAndUnreadSeparator } from "./date-and-unread-separator";
import { Button } from "@/components/ui/button";
import { RoomWithParticipantsDTO } from "@/lib/entities/models/room.model";
import { useMemo, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function MessageList({
  messages,
  bottomRef,
  unreadRef,
  onlineUserIds,
  onReply,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onToggleReaction,
  editingMessageId,
  lastReadMessageId,
  lastReadAt,
  unreadSettled = true,
  peerReadAt = null,
  userId,
  onLoadMore,
  hasMore,
  isLoadingMore,
  viewportRef,
  roomData,
  highlightedMessageId,
  onScrollToMessage,
  onRetrySend,
  onDiscardSend,
}: {
  messages: MessageWithUserDTO[];
  bottomRef: React.RefObject<HTMLDivElement | null>;
  unreadRef: React.RefObject<HTMLDivElement | null>;
  onlineUserIds: string[];
  onReply: (message: MessageWithUserDTO) => void;
  onStartEdit: (message: MessageWithUserDTO) => void;
  onSaveEdit: (messageId: string, content: string) => void;
  onCancelEdit: () => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  editingMessageId: string | null;
  lastReadMessageId: string | null;
  lastReadAt: Date | null;
  /**
   * The read position is authoritative (server snapshot in). Until then the
   * marker follows the cached data; from then on it is fixed.
   */
  unreadSettled?: boolean;
  /** DM only: how far the other person has read, for ✓ / ✓✓ on own messages. */
  peerReadAt?: Date | null;
  userId: string;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  viewportRef?: React.RefObject<HTMLDivElement | null>;
  roomData: RoomWithParticipantsDTO;
  highlightedMessageId?: string | null;
  onScrollToMessage?: (messageId: string) => void;
  onRetrySend?: (message: MessageWithUserDTO) => void;
  onDiscardSend?: (message: MessageWithUserDTO) => void;
}) {
  // --- UNREAD SEPARATOR LOGIC ---
  // We want the separator to stay at its INITIAL position when the user entered.
  // It should not "jump" or "descend" as messages are marked as read.
  const [initialUnreadId, setInitialUnreadId] = useState<string | null>(null);
  const [isUnreadCleared, setIsUnreadCleared] = useState(false);
  // Decided once the server snapshot is in (`unreadSettled`), then fixed.
  // Before this freeze, a room with nothing unread kept re-evaluating on every
  // change, so each message that arrived while the room was open flashed an
  // "unread" line until the read round-trip caught up. Until it settles the
  // marker may still be found from the cached data, or appear when the
  // snapshot brings messages that arrived while the room was closed.
  const unreadFrozenRef = useRef(false);

  useEffect(() => {
    if (unreadFrozenRef.current || messages.length === 0) return;

    if (!initialUnreadId) {
      let firstUnreadIdx = -1;
      const lastReadIndex = lastReadMessageId
        ? messages.findIndex(msg => msg.id === lastReadMessageId)
        : -1;
      if (lastReadIndex !== -1) {
        for (let i = lastReadIndex + 1; i < messages.length; i++) {
          if (messages[i].userId !== userId) {
            firstUnreadIdx = i;
            break;
          }
        }
      } else if (lastReadAt) {
        // Also covers a read anchor that is older than the loaded window.
        const lastReadTime = new Date(lastReadAt).getTime();
        firstUnreadIdx = messages.findIndex(msg =>
          new Date(msg.createdAt).getTime() > lastReadTime &&
          msg.userId !== userId &&
          !msg.isOptimistic
        );
      }
      if (firstUnreadIdx !== -1) setInitialUnreadId(messages[firstUnreadIdx].id);
    }

    if (unreadSettled) unreadFrozenRef.current = true;
  }, [messages, lastReadMessageId, lastReadAt, userId, initialUnreadId, unreadSettled]);

  // Monitor if the unread state has been cleared (lastReadAt is newer than our initial unread message)
  useEffect(() => {
    if (!initialUnreadId || isUnreadCleared) return;

    const unreadMsg = messages.find(m => m.id === initialUnreadId);
    if (!unreadMsg) return;

    const unreadTime = new Date(unreadMsg.createdAt).getTime();
    const currentReadTime = lastReadAt ? new Date(lastReadAt).getTime() : 0;

    // If we have now read past the initial unread message OR the ID itself is now the lastReadId
    if (currentReadTime >= unreadTime || lastReadMessageId === initialUnreadId) {
      // Small delay for UX so user sees the line for a split second before it fades
      const timer = setTimeout(() => setIsUnreadCleared(true), 300);
      return () => clearTimeout(timer);
    }
  }, [messages, lastReadAt, lastReadMessageId, initialUnreadId, isUnreadCleared]);

  let lastDate: string | null = null;
  const peerReadTime = peerReadAt ? new Date(peerReadAt).getTime() : 0;

  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore || isLoadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { root: viewportRef?.current, threshold: 0.1 }
    );
    const currentRef = loadMoreRef.current;
    if (currentRef) observer.observe(currentRef);
    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, [hasMore, isLoadingMore, onLoadMore, viewportRef]);

  // We compute the chronologically arranged nodes first so prevMsg logic remains identically sound.
  const nodes: React.ReactNode[] = [];

  messages.forEach((msg, index) => {
    const msgDate = new Date(msg.createdAt);
    const currentDate = msgDate.toDateString();
    const shouldShowDate = currentDate !== lastDate;
    const isInitialUnread = initialUnreadId === msg.id && !isUnreadCleared;

    const showDateSeparator = shouldShowDate && !isInitialUnread;
    const showUnreadAndDate = shouldShowDate && isInitialUnread;
    const showUnreadOnly = !showDateSeparator && !showUnreadAndDate && isInitialUnread;

    const prevMsg = index > 0 ? messages[index - 1] : null;
    const isSameSender = prevMsg?.userId === msg.userId;
    const msgTime = msgDate.getTime();
    const prevTime = prevMsg ? new Date(prevMsg.createdAt).getTime() : 0;
    const isRecent = msgTime - prevTime < 5 * 60 * 1000; // 5 minutes
    const isContinuation = isSameSender && isRecent && !shouldShowDate && !isInitialUnread;

    lastDate = currentDate;

    const hasSeparator = (showDateSeparator && index > 0) || showUnreadAndDate || showUnreadOnly;

    nodes.push(
      <div
        id={`message-${msg.id}`}
        key={`msg-container-${msg.id}`}
        ref={isInitialUnread ? unreadRef : null}
        data-message-id={msg.id}
        className="message-container"
      >
        {hasSeparator && (
          <AnimatePresence mode="popLayout">
            {showDateSeparator && index > 0 && (
              <motion.div
                key={`date-${msg.id}`}
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <DateSeparator date={msgDate} />
              </motion.div>
            )}

            {showUnreadAndDate && (
              <motion.div
                key={`unread-date-${msg.id}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0, transition: { duration: 0.4 } }}
                className="overflow-hidden"
              >
                <DateAndUnreadSeparator date={msgDate} />
              </motion.div>
            )}

            {showUnreadOnly && (
              <motion.div
                key={`unread-${msg.id}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0, transition: { duration: 0.4 } }}
                className="overflow-hidden"
              >
                <UnreadSeparator />
              </motion.div>
            )}
          </AnimatePresence>
        )}

        <MessageItem
          message={msg}
          onlineUserIds={onlineUserIds}
          onReply={onReply}
          onStartEdit={onStartEdit}
          onSaveEdit={onSaveEdit}
          onCancelEdit={onCancelEdit}
          onToggleReaction={onToggleReaction}
          isEditing={editingMessageId === msg.id}
          currentUserId={userId}
          isContinuation={isContinuation}
          isAfterSeparator={(showDateSeparator && index > 0) || showUnreadAndDate || (!showDateSeparator && !showUnreadAndDate && isInitialUnread)}
          isHighlighted={msg.id === highlightedMessageId}
          onScrollToMessage={onScrollToMessage}
          onRetrySend={onRetrySend}
          onDiscardSend={onDiscardSend}
          roomData={roomData}
          receipt={
            roomData.isDirect && msg.userId === userId && !msg.isOptimistic && !msg.sendError
              ? peerReadTime >= msgTime ? "read" : "sent"
              : undefined
          }
        />
      </div>
    );
  });

  const partner = roomData.isDirect
    ? roomData.participants.find((p: any) => p.user.id !== userId)?.user
    : null;

  return (
    <div
      ref={viewportRef}
      className="h-full w-full overflow-y-auto overflow-x-hidden flex flex-col-reverse pt-2 overflow-anchor-auto"
    >
      <div ref={bottomRef} className="h-3 shrink-0" />
      {nodes.reverse()}

      {/* Header and Load More are last in the flex-col-reverse -> visual top */}
      {!hasMore && (
        <div className="px-4 pt-10 pb-2 shrink-0">
          {roomData.isDirect ? (
            <UserAvatar
              src={partner?.avatar || "/avatars/avatar1.png"}
              alt={partner?.username || "Pengguna"}
              className="h-16 w-16 rounded-full"
            />
          ) : roomData.avatar ? (
            <UserAvatar
              src={roomData.avatar}
              alt={roomData.name}
              className="h-16 w-16 rounded-xl"
            />
          ) : (
            <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center">
              <Hash weight="bold" className="h-8 w-8 text-muted-foreground" />
            </div>
          )}

          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            {roomData.isDirect
              ? partner?.name || partner?.username || "Pengguna"
              : `#${roomData.name}`}
          </h1>
          {roomData.isDirect && partner?.username && (
            <p className="text-sm text-muted-foreground">@{partner.username}</p>
          )}
          <p className="mt-2 text-sm text-muted-foreground max-w-lg">
            {roomData.isDirect
              ? <>Ini awal percakapanmu dengan <span className="font-medium text-foreground">{partner?.name || partner?.username}</span>.</>
              : <>Ini awal channel <span className="font-medium text-foreground">#{roomData.name}</span>.{roomData.description ? ` ${roomData.description}` : ""}</>}
          </p>

          {messages.length > 0 ? (
            <div className="-mx-4 mt-4">
              <DateSeparator date={new Date(messages[0].createdAt)} />
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              Belum ada pesan di sini.
            </p>
          )}
        </div>
      )}

      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center items-center py-6 shrink-0">
          {isLoadingMore ? (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <CircleNotch className="h-3.5 w-3.5 animate-spin" />
              Memuat pesan sebelumnya…
            </span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLoadMore}
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              Muat pesan sebelumnya
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
