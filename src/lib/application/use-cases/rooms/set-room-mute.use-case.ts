import { IRoomRepository } from "../../repositories/room.repository.interface";
import { IPusherService } from "../../services/pusher.service.interface";

export type MuteDuration = "1h" | "8h" | "1w" | "forever" | "off";

const HOUR = 60 * 60 * 1000;
/** "Forever" is stored as a far-future date so one column covers every case. */
export const MUTE_FOREVER = new Date("9999-12-31T00:00:00.000Z");

/**
 * Mute a room's notifications for this user (or unmute with "off").
 * Durations are the middle ground of WhatsApp (8h, 1 week, always) and
 * Telegram (1h, 8h, 2 days, forever). Mentions still notify (all three of
 * WhatsApp, Telegram and Teams do that); see SendMessageUseCase and the client
 * notification listener.
 */
export class SetRoomMuteUseCase {
  constructor(
    private roomRepository: Pick<IRoomRepository, "setMutedUntil">,
    private pusherService: Pick<IPusherService, "triggerToUsers">,
  ) {}

  static until(duration: MuteDuration, now = Date.now()): Date | null {
    switch (duration) {
      case "1h":
        return new Date(now + HOUR);
      case "8h":
        return new Date(now + 8 * HOUR);
      case "1w":
        return new Date(now + 7 * 24 * HOUR);
      case "forever":
        return MUTE_FOREVER;
      case "off":
        return null;
    }
  }

  async execute(userId: string, roomId: string, duration: MuteDuration): Promise<Date | null> {
    const mutedUntil = SetRoomMuteUseCase.until(duration);
    await this.roomRepository.setMutedUntil(userId, roomId, mutedUntil);
    // The user's other tabs and devices follow along.
    await this.pusherService.triggerToUsers([userId], "room-mute-changed", { roomId, mutedUntil });
    return mutedUntil;
  }
}
