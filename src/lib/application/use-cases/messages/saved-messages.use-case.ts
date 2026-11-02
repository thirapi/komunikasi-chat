import { SavedMessageDTO } from "@/lib/entities/models/saved-message.model";
import { ISavedMessageRepository } from "../../repositories/saved-message.repository.interface";
import { IMessageRepository } from "../../repositories/message.repository.interface";
import { IRoomRepository } from "../../repositories/room.repository.interface";

/**
 * Saved messages, the middle ground of WhatsApp's starred messages and Teams'
 * saved messages: save any message you can read, list them, jump back to them.
 * Telegram's separate "Saved Messages" chat is left out.
 */
export class SavedMessagesUseCase {
  constructor(
    private savedRepository: ISavedMessageRepository,
    private messageRepository: Pick<IMessageRepository, "getMessageById">,
    private roomRepository: Pick<IRoomRepository, "getRoomAccess">,
  ) {}

  async toggle(userId: string, messageId: string): Promise<boolean> {
    if (await this.savedRepository.isSaved(userId, messageId)) {
      await this.savedRepository.unsave(userId, messageId);
      return false;
    }
    const message = await this.messageRepository.getMessageById(messageId);
    if (!message) throw new Error("Pesan tidak ditemukan");
    const access = await this.roomRepository.getRoomAccess(message.roomId, userId);
    if (!access.isMember) throw new Error("Pesan tidak ditemukan");
    await this.savedRepository.save(userId, messageId);
    return true;
  }

  list(userId: string): Promise<SavedMessageDTO[]> {
    return this.savedRepository.list(userId, 200);
  }

  ids(userId: string): Promise<string[]> {
    return this.savedRepository.listIds(userId, 1000);
  }
}
