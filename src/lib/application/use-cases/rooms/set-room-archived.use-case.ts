import { IRoomRepository } from "../../repositories/room.repository.interface";
import { IPusherService } from "../../services/pusher.service.interface";

/**
 * Archive or unarchive a chat for one user. A new message brings an archived
 * chat back unless it is muted (Telegram's rule; see SendMessageUseCase), the
 * middle ground between WhatsApp (stays archived) and Teams (hidden until
 * someone writes).
 */
export class SetRoomArchivedUseCase {
  constructor(
    private roomRepository: Pick<IRoomRepository, "setArchived">,
    private pusherService: Pick<IPusherService, "triggerToUsers">,
  ) {}

  async execute(userId: string, roomId: string, archived: boolean): Promise<Date | null> {
    const archivedAt = archived ? new Date() : null;
    await this.roomRepository.setArchived([userId], roomId, archivedAt);
    await this.pusherService.triggerToUsers([userId], "room-archive-changed", { roomId, archivedAt });
    return archivedAt;
  }
}
