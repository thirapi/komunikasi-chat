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
  getRoomIdByMessageId(messageId: string): Promise<string | null>;
  updateMessage(messageId: string, content: string): Promise<MessageWithUserDTO>;
  deleteMessage(messageId: string): Promise<void>;
  /** Without roomId, results are limited to rooms viewerId belongs to (none if viewerId is missing). */
  searchMessages(query: string, roomId?: string, limit?: number, viewerId?: string): Promise<MessageWithUserDTO[]>;
  getAttachmentsByUserId(userId: string, limit?: number): Promise<AttachmentWithMessageDTO[]>;
  getAttachmentsByRoomId(roomId: string, limit?: number): Promise<AttachmentWithMessageDTO[]>;
}
