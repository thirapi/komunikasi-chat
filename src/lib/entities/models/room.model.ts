import { AttachmentRecord } from "./attachment.model";

export interface RoomRecord {
  id: string;
  name: string;
  isDirect: boolean;
  description: string | null;
  avatar: string;
  banner?: string | null;
  isPublic: boolean;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SidebarRoomDTO {
  id: string;
  name: string;
  url: string;
  avatar: string;
  hasUnread: boolean;
  hasMention: boolean;
  /** Unread messages from others, capped at 100 (shown as "99+"). */
  unreadCount: number;
  /** Muted until this time, or null. */
  mutedUntil: Date | null;
  archivedAt: Date | null;
  /** Pinned to the top of the chat list. */
  chatPinnedAt: Date | null;
  /** Marked as unread by the user (no count, just a dot). */
  markedUnread: boolean;
  type: "channel" | "direct";
  userId?: string;
  lastMessage?: string;
  lastMessageTime?: Date;
}

/**
 * Flat projection backing the sidebar. Carries only the fields the sidebar
 * renders, so the repository does not have to materialise full participant
 * profiles and role lists for every room the user belongs to.
 */
export interface SidebarRoomRow {
  roomId: string;
  roomName: string;
  roomAvatar: string;
  isDirect: boolean;
  lastReadAt: Date | null;
  mutedUntil: Date | null;
  archivedAt: Date | null;
  chatPinnedAt: Date | null;
  markedUnread: boolean;
  lastMessageId: string | null;
  lastMessageContent: string | null;
  lastMessageUserId: string | null;
  lastMessageCreatedAt: Date | null;
  lastMessageAttachmentUrl: string | null;
  lastMessageAttachmentType: string | null;
  otherUserId: string | null;
  otherUsername: string | null;
  otherAvatar: string | null;
  hasMention: boolean;
  unreadCount: number | string | null;
}

export interface RoomWithParticipantsDTO extends RoomRecord {  createdAt: Date;
  updatedAt: Date;
  participants: {
    lastReadMessageId: string | null;
    lastReadAt: Date | null;
    /** owner / admin / member (only set by getRoomById). */
    role?: RoomRole;
    user: {
      id: string;
      username: string;
      name?: string | null;
      avatar: string;
      bio?: string | null;
      banner?: string | null;
      customStatus?: string | null;
      createdAt: Date;
      /** Exact last activity, only when both sides allow it (see GetRoomByIdUseCase). */
      lastSeenAt?: Date | null;
      /** Rough last seen when the exact time is hidden. */
      lastSeenLabel?: LastSeenLabel | null;
      /** Privacy flags; only kept on the viewer's own entry. */
      showLastSeen?: boolean;
      readReceipts?: boolean;
      userRoles: {
        role: {
          name: string;
        };
      }[];
    };
  }[];
  messages: {
    id: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    attachments?: AttachmentRecord[];
    isDeleted?: boolean;
  }[];
}

/** Telegram-style rough last seen, used when the exact time is private. */
export type LastSeenLabel = "recently" | "week" | "month" | "long";

export type RoomRole = "owner" | "admin" | "member";

/**
 * What a role may do in a channel, the middle ground of WhatsApp, Telegram and
 * Teams: admins invite, remove members, edit info, pin and delete others'
 * messages; only the owner deletes the channel and appoints admins.
 */
export const canModerate = (role: RoomRole | null | undefined) => role === "owner" || role === "admin";
