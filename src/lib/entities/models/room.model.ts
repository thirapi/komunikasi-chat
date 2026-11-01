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
    user: {
      id: string;
      username: string;
      name?: string | null;
      avatar: string;
      bio?: string | null;
      banner?: string | null;
      customStatus?: string | null;
      createdAt: Date;
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
