import { roomChannel } from "@/lib/pusher/channels";
import { IUserRepository } from "../../repositories/user.repository.interface";
import { IRoomRepository } from "../../repositories/room.repository.interface";
import { IPusherService } from "../../services/pusher.service.interface";

/**
 * Rooms up to this size also get typing on each member's private channel, so
 * the chat list can show "sedang mengetik…" like Telegram (DMs and small
 * groups). Bigger rooms only get it in the room itself: fanning every typing
 * pause out to everyone's sidebar would be noise and Pusher traffic.
 */
export const SIDEBAR_TYPING_MAX_MEMBERS = 10;

export class TypingUseCase {
  constructor(
    private pusherService: IPusherService,
    private userRepository: IUserRepository,
    private roomRepository?: Pick<IRoomRepository, "getParticipantIds">,
  ) {}

  private async notifySidebars(userId: string, roomId: string, payload: Record<string, unknown>) {
    if (!this.roomRepository) return;
    const members = await this.roomRepository.getParticipantIds(roomId);
    if (members.length > SIDEBAR_TYPING_MAX_MEMBERS) return;
    const others = members.filter((id) => id !== userId);
    if (others.length === 0) return;
    await this.pusherService.triggerToUsers(others, "room-typing", { roomId, userId, ...payload });
  }

  async startTyping(userId: string, roomId: string): Promise<void> {
    if (!userId) return; // Prevent unnecessary calls if userId is empty
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) throw new Error("User not found");

      await Promise.all([
        this.pusherService.trigger(roomChannel(roomId), "user-typing", {
          userId,
          username: user.username,
          typing: true,
        }),
        this.notifySidebars(userId, roomId, {
          username: user.username,
          name: user.name ?? null,
          typing: true,
        }),
      ]);
    } catch (err) {
      console.error("Pusher error:", err);
    }
  }

  async stopTyping(userId: string, roomId: string): Promise<void> {
    if (!userId) return; // Prevent unnecessary calls if userId is empty
    try {
      await Promise.all([
        this.pusherService.trigger(roomChannel(roomId), "user-typing", {
          userId,
          typing: false,
        }),
        this.notifySidebars(userId, roomId, { typing: false }),
      ]);
    } catch (err) {
      console.error("Pusher error:", err);
    }
  }
}
