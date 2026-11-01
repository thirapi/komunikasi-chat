import { roomChannel } from "@/lib/pusher/channels";
import { MessageWithUserDTO } from "../../../entities/models/message.model";
import { IMessageRepository } from "../../repositories/message.repository.interface";
import { IPusherService } from "../../services/pusher.service.interface";

export class EditMessageUseCase {
    constructor(
        private messageRepository: IMessageRepository,
        private pusherService: IPusherService
    ) { }

    async execute(
        userId: string,
        messageId: string,
        content: string
    ): Promise<MessageWithUserDTO> {
        const existingMessage = await this.messageRepository.getMessageById(messageId);

        if (!existingMessage) {
            throw new Error("Message not found");
        }

        if (existingMessage.userId !== userId) {
            throw new Error("Unauthorized: You can only edit your own messages");
        }

        const updatedMessage = await this.messageRepository.updateMessage(messageId, content);

        await this.pusherService.trigger(roomChannel(updatedMessage.roomId), "message-updated", updatedMessage);

        return updatedMessage;
    }
}
