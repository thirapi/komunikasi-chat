import { MessageWithUserDTO } from "@/lib/entities/models/message.model";
import { AttachmentWithMessageDTO } from "@/lib/entities/models/attachment.model";

export interface IMessageRepository {
  createMessage(
    userId: string,
    content: string,
    roomId: string,
    replyTo?: string,
    attachments?: { url: string; key: string; fileType: string; size?: number }[],
  ): Promise<MessageWithUserDTO>;
  getMessagesByRoomId(roomId: string, limit?: number, before?: Date, after?: Date): Promise<MessageWithUserDTO[]>;
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
  ): Promise<{ changed: MessageWithUserDTO[]; deletedIds: string[]; overflow: boolean }>;
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
