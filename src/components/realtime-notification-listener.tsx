"use client";

import { userChannel } from "@/lib/pusher/channels";
import { useEffect, useRef } from "react";
import { getPusher } from "@/lib/pusher/pusher.client";
import { toast } from "sonner";
import { requestNotificationPermission } from "@/utils/notifications";
import { usePathname, useRouter } from "next/navigation";
import { useUnread } from "./unread-provider";
import { UserAvatar } from "./ui/user-avatar";
import { hapticLight } from "@/lib/native/haptics";
import { stripMarkdown } from "@/lib/strip-markdown";
import { navigateToRoom } from "@/lib/chat/room-navigation";
import { messagePreview } from "@/lib/chat/message-preview";

interface Props {
  user: {
    id: string;
    username: string;
  };
}

export function RealtimeNotificationListener({ user }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { markAsUnread, markAsRead, recordActivity, unreadRooms } = useUnread();
  // Rooms the sidebar already knows about; a message from any other room means
  // someone started a DM / added us to a channel, so the sidebar must reload.
  const knownRoomsRef = useRef(unreadRooms);
  knownRoomsRef.current = unreadRooms;
  const refreshedForRef = useRef(new Set<string>());

  // Read through a ref so the Pusher subscription is bound once for the whole
  // session. `pathname` in the dependency array used to tear down and rebuild
  // the channel (unbind_all + unsubscribe + subscribe + 3 binds) on every route
  // change, and the handler was reading a stale pathname in between.
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const playNotificationSound = () => {
    try {
      const audio = new Audio("/sounds/message-notification.mp3");
      audio.play().catch((e) => {
        // This is usually due to browser autoplay policy
        console.warn("[Notification] Audio play failed (user interaction required):", e);
      });
    } catch (e) {
      console.warn("[Notification] Audio context failed:", e);
    }
  };

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    if (!user.id) return;

    const channel = getPusher().subscribe(userChannel(user.id));

    // CHAT: New Message
    channel.bind("new-message-notification", (data: any) => {
      const { message, room } = data;
      const sender = message.user?.name || message.user?.username || "Seseorang";
      const avatar = message.user?.avatar || "/avatars/avatar1.png";
      const raw: string = message.content || "";
      const mentionsMe = raw.includes(`<@${user.id}>`) || raw.includes("<@everyone>");
      const content =
        stripMarkdown(raw.replace(new RegExp(`<@${user.id}>`, "g"), `@${user.username}`)) ||
        (message.attachments?.length ? "Mengirim lampiran" : "Pesan baru");
      const roomId = message.roomId;
      const roomUrl = `/channels/${roomId}`;
      const context = room && !room.isDirect && room.name ? `#${room.name}` : "Pesan langsung";

      const isViewingRoom = pathnameRef.current === roomUrl;

      if (message.userId === user.id) {
        return;
      }

      // Keep the sidebar preview, time and ordering live for every room.
      recordActivity(roomId, messagePreview(message, user), message.createdAt ?? new Date());
      if (!(roomId in knownRoomsRef.current) && !refreshedForRef.current.has(roomId)) {
        refreshedForRef.current.add(roomId);
        router.refresh();
      }

      // The open room plays its own sound and handles read state
      // (chat-room.tsx). If it is open but the tab is in the background, the
      // message is still unread: flag it (sidebar dot, tab title) without a
      // second chime; chat-room clears it when the user comes back.
      if (isViewingRoom) {
        if (document.visibilityState !== "visible" || !document.hasFocus()) {
          markAsUnread(roomId, mentionsMe);
        }
        return;
      }

      playNotificationSound();
      hapticLight();
      markAsUnread(roomId, mentionsMe);

      toast.custom((t) => (
        <button
          type="button"
          className="flex w-[356px] max-w-[calc(100vw-2rem)] items-start gap-3 rounded-lg border border-border bg-popover p-3 text-left shadow-lg hover:bg-muted/60 transition-colors"
          onClick={() => {
            toast.dismiss(t);
            navigateToRoom(roomUrl);
          }}
        >
          <UserAvatar src={avatar} alt={sender} className="h-9 w-9 rounded-full" />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{sender}</p>
              <p className="text-[11px] text-muted-foreground truncate shrink-0 max-w-[45%]">{context}</p>
            </div>
            <p className="mt-0.5 text-[13px] text-muted-foreground line-clamp-2 break-words">
              {mentionsMe && (
                <span className="mr-1 rounded px-1 text-[10px] font-semibold uppercase tracking-wide bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  Menyebutmu
                </span>
              )}
              {content}
            </p>
          </div>
        </button>
      ), {
        duration: 5000,
        position: "top-right",
      });

      if ("Notification" in window && Notification.permission === "granted" && document.visibilityState === "hidden") {
        new Notification(room && !room.isDirect ? `${sender} · ${context}` : sender, {
          body: content,
          icon: avatar,
          tag: `chat-${roomId}`,
        }).onclick = () => {
          window.focus();
          navigateToRoom(roomUrl);
        };
      }
    });

    // CHAT: Message Deleted
    channel.bind("message-deleted-notification", (data: { roomId?: string }) => {
      // A refresh re-renders the whole server tree. A deletion in a room the
      // user is not viewing cannot change what is on screen, so only refresh
      // for the room currently open; otherwise rely on the unread badge.
      if (data?.roomId && pathnameRef.current === `/channels/${data.roomId}`) {
        router.refresh();
      }
    });
    // CHAT: Mark as Read Sync
    channel.bind("room-marked-read", (data: { roomId: string }) => {
      markAsRead(data.roomId);
    });

    return () => {
      channel.unbind_all();
      getPusher().unsubscribe(userChannel(user.id));
    };
  }, [user.id, user.username, markAsUnread, markAsRead, recordActivity, router]);

  return null;
}
