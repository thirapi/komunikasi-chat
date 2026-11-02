import { MessageRecord, MessageWithUserDTO } from "@/lib/entities/models/message.model";
import { IMessageRepository } from "../../repositories/message.repository.interface";

export class GetMessageUseCase {
  constructor(private messageRepository: IMessageRepository) { }

  async execute(roomId: string, limit?: number, before?: Date, after?: Date, viewerId?: string): Promise<MessageWithUserDTO[]> {
    const message = await this.messageRepository.getMessagesByRoomId(roomId, limit, before, after, viewerId);

    if (!message) {
      throw new Error("Message not found");
    }

    return message;
  }
}
