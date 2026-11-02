import { IHiddenMessageRepository } from "../../repositories/hidden-message.repository.interface";
import { IMessageRepository } from "../../repositories/message.repository.interface";
import { IRoomRepository } from "../../repositories/room.repository.interface";
import { IPusherService } from "../../services/pusher.service.interface";

/**
 * "Delete for me" (WhatsApp, Telegram): hide any message you can read from
 * your own view only; everyone else keeps it. Your other devices drop it too.
 */
export class HideMessageUseCase {
  constructor(
    private hiddenRepository: Pick<IHiddenMessageRepository, "hide">,
    private messageRepository: Pick<IMessageRepository, "getMessageById">,
    private roomRepository: Pick<IRoomRepository, "getRoomAccess">,
    private pusherService: Pick<IPusherService, "triggerToUsers">,
  ) {}

  async execute(userId: string, messageId: string): Promise<{ roomId: string }> {
    const message = await this.messageRepository.getMessageById(messageId);
    if (!message) throw new Error("Pesan tidak ditemukan");
    const access = await this.roomRepository.getRoomAccess(message.roomId, userId);
    if (!access.isMember) throw new Error("Pesan tidak ditemukan");
    await this.hiddenRepository.hide(userId, messageId);
    await this.pusherService.triggerToUsers([userId], "message-hidden", { roomId: message.roomId, messageId });
    return { roomId: message.roomId };
  }
}
