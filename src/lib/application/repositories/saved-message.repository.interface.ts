import { SavedMessageDTO } from "@/lib/entities/models/saved-message.model";

export interface ISavedMessageRepository {
  isSaved(userId: string, messageId: string): Promise<boolean>;
  save(userId: string, messageId: string): Promise<void>;
  unsave(userId: string, messageId: string): Promise<void>;
  /**
   * Saved messages that are not deleted and in rooms the user is still a
   * member of, most recently saved first.
   */
  list(userId: string, limit: number): Promise<SavedMessageDTO[]>;
  /** Ids only, for marking messages in an open room. */
  listIds(userId: string, limit: number): Promise<string[]>;
}
