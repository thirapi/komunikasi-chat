import { roomChannel } from "@/lib/pusher/channels";
import { PinnedMessageDTO } from "@/lib/entities/models/message.model";
import { IMessageRepository } from "../../repositories/message.repository.interface";
import { IRoomRepository } from "../../repositories/room.repository.interface";
import { IPusherService } from "../../services/pusher.service.interface";

/**
 * Pins per room. WhatsApp allows 3, Telegram any number, Teams a handful; 5
 * keeps the banner useful. Pinning one more replaces the oldest pin, the way
 * WhatsApp does.
 */
export const MAX_PINS = 5;

export class PinError extends Error {}

/**
 * Pin or unpin a message. Who may: both people in a DM; in a channel its owner
 * or an admin (WhatsApp and Telegram leave group pins to admins by default).
 * Everyone in the room gets the new pin list over the room channel.
 */
export class TogglePinUseCase {
  constructor(
    private messageRepository: Pick<IMessageRepository, "getMessageById" | "getPinnedMessages" | "setPinned">,
    private roomRepository: Pick<IRoomRepository, "getRoomAccess">,
    private pusherService: Pick<IPusherService, "trigger">,
  ) {}

  async execute(
    userId: string,
    messageId: string,
    opts: { isAdmin: boolean },
  ): Promise<{ pinned: boolean; pins: PinnedMessageDTO[] }> {
    const message = await this.messageRepository.getMessageById(messageId);
    if (!message) throw new PinError("Pesan tidak ditemukan");
    if (message.isOptimistic) throw new PinError("Pesan belum terkirim");

    const access = await this.roomRepository.getRoomAccess(message.roomId, userId);
    if (!access.isMember) throw new PinError("Kamu bukan anggota room ini");
    const allowed = access.isDirect || access.ownerId === userId || opts.isAdmin;
    if (!allowed) throw new PinError("Hanya pemilik channel atau admin yang bisa menyematkan pesan");

    const pinned = !message.pinnedAt;
    if (pinned) {
      const current = await this.messageRepository.getPinnedMessages(message.roomId, MAX_PINS + 1);
      // Make room: unpin the oldest ones beyond the limit.
      for (const old of current.slice(MAX_PINS - 1)) {
        await this.messageRepository.setPinned(old.id, null);
      }
      await this.messageRepository.setPinned(messageId, userId);
    } else {
      await this.messageRepository.setPinned(messageId, null);
    }

    const pins = await this.messageRepository.getPinnedMessages(message.roomId, MAX_PINS);
    await this.pusherService.trigger(roomChannel(message.roomId), "pins-changed", {
      roomId: message.roomId,
      pins,
    });
    return { pinned, pins };
  }
}
