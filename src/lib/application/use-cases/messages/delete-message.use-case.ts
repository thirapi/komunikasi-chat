import { roomChannel } from "@/lib/pusher/channels";
import { IMessageRepository } from "../../repositories/message.repository.interface";
import { IRoomRepository } from "../../repositories/room.repository.interface";
import { IPusherService } from "../../services/pusher.service.interface";

export class DeleteMessageUseCase {
  constructor(
    private messageRepository: IMessageRepository,
    private roomRepository: IRoomRepository,
    private pusherService: IPusherService
  ) { }

  async execute(userId: string, messageId: string): Promise<void> {
    const message = await this.messageRepository.getMessageById(messageId);

    if (!message) {
      throw new Error("Pesan tidak ditemukan");
    }

    if (message.userId !== userId) {
      throw new Error("Anda tidak memiliki izin untuk menghapus pesan ini");
    }

    await this.roomRepository.fallbackLastReadMessageId(message.roomId, messageId, message.createdAt);

    await this.messageRepository.deleteMessage(messageId);

    // Notify room channel for real-time removal in ChatRoom
    await this.pusherService.trigger(roomChannel(message.roomId), "message-deleted", {
      messageId,
      roomId: message.roomId,
    });

    // Notify all participants to refresh their sidebar
    const participants = await this.roomRepository.getOtherParticipants(
      message.roomId,
      userId
    );
    const receiverIds = participants.map((p) => p.userId);

    await this.pusherService.triggerToUsers(
      receiverIds,
      "message-deleted-notification",
      {
        messageId,
        roomId: message.roomId,
      }
    );
  }
}
