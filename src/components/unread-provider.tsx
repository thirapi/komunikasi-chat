"use client";

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from "react";

interface UnreadRoomState {
  hasUnread: boolean;
  hasMention: boolean;
  /** Unread messages from others (server count, then +1 per live message). */
  count: number;
  /**
   * When this state was last decided on this device (ms). A server snapshot
   * older than that (a router.refresh rendered from data written before the
   * read reached the DB) must not resurrect a dot the user already cleared, or
   * hide one for a message that arrived after the snapshot was taken.
   */
  at?: number;
}

type ServerRoomUnread = {
  id: string;
  hasUnread: boolean;
  hasMention: boolean;
  unreadCount?: number;
  mutedUntil?: Date | string | null;
  archivedAt?: Date | string | null;
  lastMessageTime?: Date | string | null;
};

/** Someone typing in a room, for the chat list ("Budi sedang mengetik…"). */
export interface RoomTyping {
  userId: string;
  name: string;
}

export interface RoomActivity {
  lastMessage: string;
  lastMessageTime: Date;
}

interface UnreadContextType {
  unreadRooms: Record<string, UnreadRoomState>;
  /** Latest message per room seen live (newer than the server's sidebar data). */
  roomActivity: Record<string, RoomActivity>;
  recordActivity: (roomId: string, lastMessage: string, at: Date | string) => void;
  /** Forget the live preview (its message was deleted); the server's applies again. */
  clearActivity: (roomId: string) => void;
  roomTyping: Record<string, RoomTyping>;
  /** name = null clears it (typing stopped or their message arrived). */
  setRoomTyping: (roomId: string, userId: string, name: string | null) => void;
  /** Rooms muted right now (expired mutes drop out on their own). */
  mutedRooms: Record<string, number>;
  isMuted: (roomId: string) => boolean;
  setMuted: (roomId: string, mutedUntil: Date | string | null) => void;
  /** Rooms in the chat list's archive. */
  archivedRooms: Record<string, true>;
  setArchived: (roomId: string, archived: boolean) => void;
  markAsRead: (roomId: string) => void;
  markAsUnread: (roomId: string, hasMention?: boolean) => void;
  initializeUnread: (rooms: ServerRoomUnread[]) => void;
}

const UnreadContext = createContext<UnreadContextType | undefined>(undefined);

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const [unreadRooms, setUnreadRooms] = useState<Record<string, UnreadRoomState>>({});
  const [roomActivity, setRoomActivity] = useState<Record<string, RoomActivity>>({});
  const [roomTyping, setRoomTypingState] = useState<Record<string, RoomTyping>>({});
  const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const setRoomTyping = useCallback((roomId: string, userId: string, name: string | null) => {
    const clear = () =>
      setRoomTypingState((prev) => {
        if (prev[roomId]?.userId !== userId) return prev;
        const next = { ...prev };
        delete next[roomId];
        return next;
      });
    const existing = typingTimers.current.get(roomId);
    if (existing) clearTimeout(existing);
    typingTimers.current.delete(roomId);
    if (name === null) {
      clear();
      return;
    }
    setRoomTypingState((prev) =>
      prev[roomId]?.userId === userId && prev[roomId]?.name === name
        ? prev
        : { ...prev, [roomId]: { userId, name } },
    );
    // Typing is sent on each pause and stopped after 5s idle; if the stop
    // event is lost (tab closed, network), expire it on our own.
    typingTimers.current.set(roomId, setTimeout(() => {
      typingTimers.current.delete(roomId);
      clear();
    }, 6000));
  }, []);
  useEffect(() => {
    const timers = typingTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const recordActivity = useCallback((roomId: string, lastMessage: string, at: Date | string) => {
    const time = new Date(at);
    setRoomActivity((prev) => {
      const current = prev[roomId];
      if (current && current.lastMessageTime.getTime() > time.getTime()) return prev;
      return { ...prev, [roomId]: { lastMessage, lastMessageTime: time } };
    });
  }, []);

  const clearActivity = useCallback((roomId: string) => {
    setRoomActivity((prev) => {
      if (!(roomId in prev)) return prev;
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
  }, []);

  // Muted rooms: roomId -> muted until (ms). Only active mutes are kept, and
  // a timer drops each one when it expires so badges turn back on by
  // themselves.
  const [mutedRooms, setMutedRooms] = useState<Record<string, number>>({});
  const setMuted = useCallback((roomId: string, mutedUntil: Date | string | null) => {
    const until = mutedUntil ? new Date(mutedUntil).getTime() : 0;
    setMutedRooms((prev) => {
      if (until > Date.now()) return prev[roomId] === until ? prev : { ...prev, [roomId]: until };
      if (!(roomId in prev)) return prev;
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
  }, []);
  useEffect(() => {
    const now = Date.now();
    const soonest = Math.min(...Object.values(mutedRooms), Infinity);
    if (!Number.isFinite(soonest)) return;
    // setTimeout overflows past ~24.8 days; re-check daily for long mutes.
    const t = setTimeout(() => {
      setMutedRooms((prev) => {
        const at = Date.now();
        const next = Object.fromEntries(Object.entries(prev).filter(([, until]) => until > at));
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, Math.min(Math.max(0, soonest - now) + 50, 24 * 60 * 60 * 1000));
    return () => clearTimeout(t);
  }, [mutedRooms]);
  const [archivedRooms, setArchivedRooms] = useState<Record<string, true>>({});
  const setArchived = useCallback((roomId: string, archived: boolean) => {
    setArchivedRooms((prev) => {
      if (archived === !!prev[roomId]) return prev;
      const next = { ...prev };
      if (archived) next[roomId] = true;
      else delete next[roomId];
      return next;
    });
  }, []);

  const mutedRoomsRef = useRef(mutedRooms);
  mutedRoomsRef.current = mutedRooms;
  // Stable identity (reads a ref) so listeners bound once can call it.
  const isMuted = useCallback(
    (roomId: string) => (mutedRoomsRef.current[roomId] ?? 0) > Date.now(),
    [],
  );

  // "(3) Komunikasi" in the tab title, like Telegram/Slack, so unread chats
  // are visible from another tab. Muted rooms only count when they mention
  // the user (Telegram leaves muted chats out of the total too).
  const unreadCount = useMemo(
    () =>
      Object.entries(unreadRooms).filter(
        ([id, r]) => r.hasUnread && (!(mutedRooms[id] > Date.now()) || r.hasMention),
      ).length,
    [unreadRooms, mutedRooms],
  );
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\)\s*/, "");
    document.title = unreadCount > 0 ? `(${unreadCount > 99 ? "99+" : unreadCount}) ${base}` : base;
  }, [unreadCount]);

  const initializeUnread = useCallback((rooms: ServerRoomUnread[]) => {
    const now = Date.now();
    setArchivedRooms(Object.fromEntries(rooms.filter((r) => r.archivedAt).map((r) => [r.id, true as const])));
    setMutedRooms(
      Object.fromEntries(
        rooms
          .map((r) => [r.id, r.mutedUntil ? new Date(r.mutedUntil).getTime() : 0] as const)
          .filter(([, until]) => until > now),
      ),
    );
    setUnreadRooms((prev) => {
      const next: Record<string, UnreadRoomState> = {};
      for (const room of rooms) {
        const local = prev[room.id];
        const serverLatest = room.lastMessageTime ? new Date(room.lastMessageTime).getTime() : 0;
        // Keep what this device decided unless the server has seen a message
        // newer than that decision.
        next[room.id] =
          local?.at !== undefined && serverLatest <= local.at
            ? local
            : {
                hasUnread: room.hasUnread,
                hasMention: room.hasMention,
                count: room.hasUnread ? Math.max(1, room.unreadCount ?? 1) : 0,
              };
      }
      return next;
    });
  }, []);

  const markAsRead = useCallback((roomId: string) => {
    setUnreadRooms((prev) => ({
      ...prev,
      [roomId]: { hasUnread: false, hasMention: false, count: 0, at: Date.now() },
    }));
  }, []);

  const markAsUnread = useCallback((roomId: string, hasMention = false) => {
    setUnreadRooms((prev) => {
      const current = prev[roomId] || { hasUnread: false, hasMention: false, count: 0 };
      return {
        ...prev,
        [roomId]: {
          hasUnread: true,
          hasMention: hasMention || current.hasMention,
          count: (current.hasUnread ? current.count : 0) + 1,
          // Receive time on this device's clock, same as markAsRead, so the
          // two compare cleanly regardless of server clock skew.
          at: Date.now(),
        }
      };
    });
  }, []);

  const value = useMemo(
    () => ({ unreadRooms, roomActivity, recordActivity, clearActivity, roomTyping, setRoomTyping, mutedRooms, isMuted, setMuted, archivedRooms, setArchived, markAsRead, markAsUnread, initializeUnread }),
    [unreadRooms, roomActivity, recordActivity, clearActivity, roomTyping, setRoomTyping, mutedRooms, isMuted, setMuted, archivedRooms, setArchived, markAsRead, markAsUnread, initializeUnread],
  );

  return (
    <UnreadContext.Provider value={value}>
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread() {
  const context = useContext(UnreadContext);
  if (!context) {
    throw new Error("useUnread must be used within an UnreadProvider");
  }
  return context;
}
