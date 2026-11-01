import { MessageWithUserDTO } from "@/lib/entities/models/message.model";
import { IMessageRepository } from "../../repositories/message.repository.interface";

export class SearchMessagesUseCase {
  constructor(private messageRepository: IMessageRepository) { }

  async execute(query: string, roomId?: string, limit?: number, viewerId?: string): Promise<MessageWithUserDTO[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }
    return await this.messageRepository.searchMessages(query.trim(), roomId, limit, viewerId);
  }
}
