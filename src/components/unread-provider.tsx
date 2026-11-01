"use client";

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";

interface UnreadRoomState {
  hasUnread: boolean;
  hasMention: boolean;
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
  markAsRead: (roomId: string) => void;
  markAsUnread: (roomId: string, hasMention?: boolean) => void;
  initializeUnread: (rooms: { id: string; hasUnread: boolean; hasMention: boolean }[]) => void;
}

const UnreadContext = createContext<UnreadContextType | undefined>(undefined);

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const [unreadRooms, setUnreadRooms] = useState<Record<string, UnreadRoomState>>({});
  const [roomActivity, setRoomActivity] = useState<Record<string, RoomActivity>>({});

  const recordActivity = useCallback((roomId: string, lastMessage: string, at: Date | string) => {
    const time = new Date(at);
    setRoomActivity((prev) => {
      const current = prev[roomId];
      if (current && current.lastMessageTime.getTime() > time.getTime()) return prev;
      return { ...prev, [roomId]: { lastMessage, lastMessageTime: time } };
    });
  }, []);

  // "(3) Komunikasi" in the tab title, like Telegram/Slack, so unread chats
  // are visible from another tab.
  const unreadCount = useMemo(
    () => Object.values(unreadRooms).filter((r) => r.hasUnread).length,
    [unreadRooms],
  );
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\)\s*/, "");
    document.title = unreadCount > 0 ? `(${unreadCount > 99 ? "99+" : unreadCount}) ${base}` : base;
  }, [unreadCount]);

  const initializeUnread = useCallback((rooms: { id: string; hasUnread: boolean; hasMention: boolean }[]) => {
    const initial = rooms.reduce((acc, room) => {
      acc[room.id] = { hasUnread: room.hasUnread, hasMention: room.hasMention };
      return acc;
    }, {} as Record<string, UnreadRoomState>);
    setUnreadRooms(initial);
  }, []);

  const markAsRead = useCallback((roomId: string) => {
    setUnreadRooms((prev) => ({ ...prev, [roomId]: { hasUnread: false, hasMention: false } }));
  }, []);

  const markAsUnread = useCallback((roomId: string, hasMention = false) => {
    setUnreadRooms((prev) => {
      const current = prev[roomId] || { hasUnread: false, hasMention: false };
      return {
        ...prev,
        [roomId]: {
          hasUnread: true,
          hasMention: hasMention || current.hasMention
        }
      };
    });
  }, []);

  const value = useMemo(
    () => ({ unreadRooms, roomActivity, recordActivity, markAsRead, markAsUnread, initializeUnread }),
    [unreadRooms, roomActivity, recordActivity, markAsRead, markAsUnread, initializeUnread],
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
