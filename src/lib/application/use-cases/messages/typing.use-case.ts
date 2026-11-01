import { roomChannel } from "@/lib/pusher/channels";
import { IUserRepository } from "../../repositories/user.repository.interface";
import { IPusherService } from "../../services/pusher.service.interface";

export class TypingUseCase {
  constructor(
    private pusherService: IPusherService,
    private userRepository: IUserRepository
  ) {}

  async startTyping(userId: string, roomId: string): Promise<void> {
    if (!userId) return; // Prevent unnecessary calls if userId is empty
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) throw new Error("User not found");

      await this.pusherService.trigger(roomChannel(roomId), "user-typing", {
        userId,
        username: user.username,
        typing: true,
      });
    } catch (err) {
      console.error("Pusher error:", err);
    }
  }

  async stopTyping(userId: string, roomId: string): Promise<void> {
    if (!userId) return; // Prevent unnecessary calls if userId is empty
    try {
      await this.pusherService.trigger(roomChannel(roomId), "user-typing", {
        userId,
        typing: false,
      });
    } catch (err) {
      console.error("Pusher error:", err);
    }
  }
}
