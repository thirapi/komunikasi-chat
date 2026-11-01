import { roomChannel } from "@/lib/pusher/channels";
import { getPusher } from "@/lib/pusher/pusher.client";
import { useEffect, useMemo, useRef, useState } from "react";

interface TypingUser {
  userId: string;
  username: string;
}

export function useTypingIndicator(roomId: string, currentUserId: string) {
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const typingTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const userMap = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const channel = getPusher().subscribe(roomChannel(roomId));

    const handleUserTyping = (data: TypingUser) => {
      if (!data.userId || !data.username || data.userId === currentUserId)
        return;

      userMap.current.set(data.userId, data.username);

      setTypingUsers((prev) => {
        const updated = new Set(prev);
        updated.add(data.userId);
        return updated;
      });

      if (typingTimeouts.current.has(data.userId)) {
        clearTimeout(typingTimeouts.current.get(data.userId)!);
      }

      const timeout = setTimeout(() => {
        setTypingUsers((prev) => {
          const updated = new Set(prev);
          updated.delete(data.userId);
          return updated;
        });
        typingTimeouts.current.delete(data.userId);
      }, 3000);

      typingTimeouts.current.set(data.userId, timeout);
    };

    channel.bind("user-typing", handleUserTyping);

    return () => {
      channel.unbind("user-typing", handleUserTyping);
      channel.unsubscribe();
      typingTimeouts.current.forEach((timeout) => clearTimeout(timeout));
      typingTimeouts.current.clear();
    };
  }, [roomId, currentUserId]);

  // Stable identity so consumers of this hook are not re-rendered on every
  // unrelated MessageInput render.
  const displayNames = useMemo(
    () => Array.from(typingUsers).map((userId) => userMap.current.get(userId) || userId),
    [typingUsers],
  );

  return {
    typingUsers,
    displayNames,
  };
}
