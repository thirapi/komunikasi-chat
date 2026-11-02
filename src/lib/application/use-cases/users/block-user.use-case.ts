import { roomChannel } from "@/lib/pusher/channels";
import { BlockStatus } from "@/lib/entities/models/block.model";
import { IUserBlockRepository } from "../../repositories/user-block.repository.interface";
import { IRoomRepository } from "../../repositories/room.repository.interface";
import { IPusherService } from "../../services/pusher.service.interface";

export class BlockError extends Error {}

/** Shown to the sender when a DM is closed by a block either way. */
export const BLOCKED_DM_MESSAGE = "Kamu tidak bisa mengirim pesan di percakapan ini";

/**
 * Block or unblock someone, the middle ground of WhatsApp, Telegram and Teams:
 * the DM between the two is closed in both directions (no new messages, no
 * new DM), channels they share are unaffected, and their online status / last
 * seen is hidden from each other. Both sides of an open DM update live.
 */
export class BlockUserUseCase {
  constructor(
    private blockRepository: IUserBlockRepository,
    private roomRepository: Pick<IRoomRepository, "findDirectRoomBetweenUsers">,
    private pusherService: Pick<IPusherService, "trigger">,
  ) {}

  async execute(userId: string, targetUserId: string, block: boolean): Promise<BlockStatus> {
    if (!targetUserId || targetUserId === userId) throw new BlockError("Tidak bisa memblokir diri sendiri");
    if (block) await this.blockRepository.block(userId, targetUserId);
    else await this.blockRepository.unblock(userId, targetUserId);

    const dm = await this.roomRepository.findDirectRoomBetweenUsers(userId, targetUserId);
    if (dm) {
      await this.pusherService.trigger(roomChannel(dm.id), "block-changed", {
        blockerId: userId,
        blockedId: targetUserId,
        blocked: block,
      });
    }
    return this.blockRepository.getStatus(userId, targetUserId);
  }

  /** Block status between the viewer and the other person in a DM (null for channels). */
  async statusForRoom(
    viewerId: string,
    room: { isDirect: boolean; participants?: { user: { id: string } }[] },
  ): Promise<BlockStatus | null> {
    if (!room.isDirect) return null;
    const other = room.participants?.find((p) => p.user.id !== viewerId)?.user.id;
    if (!other) return null;
    return this.blockRepository.getStatus(viewerId, other);
  }
}
