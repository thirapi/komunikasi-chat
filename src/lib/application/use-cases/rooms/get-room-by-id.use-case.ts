import { RoomWithParticipantsDTO } from "@/lib/entities/models/room.model";
import { IRoomRepository } from "../../repositories/room.repository.interface";
import type { IUserBlockRepository } from "../../repositories/user-block.repository.interface";
import { applyRoomPrivacy } from "./apply-room-privacy";

export class GetRoomByIdUseCase {
  constructor(
    private roomRepository: IRoomRepository,
    private blockRepository?: Pick<IUserBlockRepository, "getStatus">,
  ) {}

  /** The room as `viewerId` may see it (read positions and last seen filtered). */
  async execute(roomId: string, viewerId?: string | null): Promise<RoomWithParticipantsDTO | null> {
    const room = await this.roomRepository.getRoomById(roomId);

    if (!room) {
      throw new Error("Room not found");
    }

    // Blocks only matter for the other person in a DM.
    const blocked = new Set<string>();
    if (room.isDirect && viewerId && this.blockRepository) {
      const other = room.participants.find((p) => p.user.id !== viewerId)?.user.id;
      if (other) {
        const status = await this.blockRepository.getStatus(viewerId, other);
        if (status.iBlocked || status.blockedMe) blocked.add(other);
      }
    }

    return applyRoomPrivacy(room, viewerId ?? null, (id) => blocked.has(id));
  }
}
