import { roomChannel } from "@/lib/pusher/channels";
import type { IUserPrivacyRepository } from "../../repositories/user-privacy.repository.interface";
import { IRoomRepository } from "../../repositories/room.repository.interface";
import { IPusherService } from "../../services/pusher.service.interface";

export class UpdateLastReadAtUseCase {
  constructor(
    private roomRepository: IRoomRepository,
    private pusherService: IPusherService,
    private privacyRepository?: Pick<IUserPrivacyRepository, "getPrivacy">,
  ) {}

  async execute(
    userId: string,
    roomId: string,
    messageId: string,
    lastReadAt?: Date
  ): Promise<void> {
    if (!userId || !roomId || !messageId) {
      throw new Error("Invalid input parameters");
    }

    // Harden against race conditions: only update if the new timestamp is newer
    const currentStatus = await this.roomRepository.getLastReadAt(userId, roomId);
    if (currentStatus.at && lastReadAt && lastReadAt < currentStatus.at) {
      return;
    }

    await this.roomRepository.updateLastReadAt(userId, roomId, messageId, lastReadAt);

    const at = lastReadAt ?? new Date();

    // Broadcast read event to other devices/tabs for the same user
    await this.pusherService.triggerToUsers([userId], "room-marked-read", {
      roomId,
      messageId,
      lastReadAt: at,
    });

    // DM read receipts (✓✓): tell the other participant how far this user
    // has read, on the room's private channel. Channels/groups are left out:
    // per-member read state there is noisy and more of a privacy question.
    // Read receipts off: the other person is not told (reciprocal: the client
    // also stops showing ✓✓ for people when your own receipts are off).
    const access = await this.roomRepository.getRoomAccess(roomId, userId);
    const sendsReceipts = this.privacyRepository
      ? (await this.privacyRepository.getPrivacy(userId)).readReceipts
      : true;
    if (access.isDirect && sendsReceipts) {
      await this.pusherService.trigger(roomChannel(roomId), "read-receipt", {
        userId,
        messageId,
        lastReadAt: at,
      });
    }
  }
}
