import { AttachmentRecord } from "./attachment.model";
import { MessageReactionWithUserDTO } from "./reaction.model";

export interface MessageRecord {
  id: string;
  userId: string;
  content: string;
  roomId: string;
  replyTo?: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  attachments?: AttachmentRecord[];
  isOptimistic?: boolean;
  optimisticId?: string;
  /** Client-only: the optimistic send failed and can be retried. */
  sendError?: boolean;
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
