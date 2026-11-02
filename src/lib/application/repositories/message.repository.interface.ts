import { MessageWithUserDTO, PinnedMessageDTO } from "@/lib/entities/models/message.model";

export interface NewPoll {
  question: string;
  options: string[];
  allowMultiple: boolean;
}
import { AttachmentWithMessageDTO } from "@/lib/entities/models/attachment.model";

export interface IMessageRepository {
  createMessage(
    userId: string,
    content: string,
    roomId: string,
    replyTo?: string,
    attachments?: { url: string; key: string; fileType: string; size?: number }[],
    options?: { isForwarded?: boolean; forwardedFromUserId?: string; poll?: NewPoll },
  ): Promise<MessageWithUserDTO>;
  /** With `viewerId`, messages that viewer hid ("delete for me") are left out. */
  getMessagesByRoomId(roomId: string, limit?: number, before?: Date, after?: Date, viewerId?: string): Promise<MessageWithUserDTO[]>;
  getMessageById(messageId: string): Promise<MessageWithUserDTO | null>;
  /**
   * Messages of a room created or changed (edited, deleted, reactions) after
   * `since`, newest first, at most `limit` rows. Deleted rows are included so
   * the caller can drop them from its cache.
   */
  getRoomChangesSince(
    roomId: string,
    since: Date,
    limit: number,
    viewerId?: string,
  ): Promise<{ changed: MessageWithUserDTO[]; deletedIds: string[]; overflow: boolean }>;
  /**
   * Of the given attachment URLs, those still attached to some other message
   * that is not deleted. Their files must not be removed from storage.
   */
  getAttachmentUrlsInUse(urls: string[], excludeMessageId: string): Promise<string[]>;
  /** Pinned, non-deleted messages of a room, most recently pinned first. */
  getPinnedMessages(roomId: string, limit: number): Promise<PinnedMessageDTO[]>;
  /** Pin (with who pinned it) or unpin (null). Also bumps updatedAt. */
  setPinned(messageId: string, pinnedBy: string | null): Promise<void>;
  /** Bump updatedAt so delta sync picks up a change stored elsewhere (reactions). */
  touchMessage(messageId: string): Promise<void>;
  getRoomIdByMessageId(messageId: string): Promise<string | null>;
  updateMessage(messageId: string, content: string): Promise<MessageWithUserDTO>;
  deleteMessage(messageId: string): Promise<void>;
  /** Without roomId, results are limited to rooms viewerId belongs to (none if viewerId is missing). */
  searchMessages(query: string, roomId?: string, limit?: number, viewerId?: string): Promise<MessageWithUserDTO[]>;
  getAttachmentsByUserId(userId: string, limit?: number): Promise<AttachmentWithMessageDTO[]>;
  getAttachmentsByRoomId(roomId: string, limit?: number): Promise<AttachmentWithMessageDTO[]>;
}
