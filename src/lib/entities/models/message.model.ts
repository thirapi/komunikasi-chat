import { AttachmentRecord } from "./attachment.model";
import { MessageReactionWithUserDTO } from "./reaction.model";

export interface MessageRecord {
  id: string;
  userId: string;
  content: string;
  roomId: string;
  replyTo?: string | null;
  isDeleted: boolean;
  pinnedAt?: Date | null;
  editedAt?: Date | null;
  isForwarded?: boolean;
  pinnedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  attachments?: AttachmentRecord[];
  isOptimistic?: boolean;
  optimisticId?: string;
  /** Client-only: the optimistic send failed and can be retried. */
  sendError?: boolean;
  /** Client-only: attachment upload progress (0–100) while sending. */
  uploadProgress?: number;
}

export interface MessageWithUserDTO extends MessageRecord {
  user: {
    username: string;
    name?: string | null;
    avatar?: string | null;
    bio?: string | null;
    banner?: string | null;
    customStatus?: string | null;
  };
  replyToMessage?: {
    id: string;
    content: string;
    user: {
      username: string;
      name?: string | null;
    };
  } | null;
  reactions?: MessageReactionWithUserDTO[];
}

/** A pinned message as the room's pin banner needs it. */
export interface PinnedMessageDTO {
  id: string;
  content: string;
  userId: string;
  user: { username: string; name: string | null };
  createdAt: Date;
  pinnedAt: Date;
  /** File type of the first attachment, for "📷 Foto"-style previews. */
  attachmentType: string | null;
}
