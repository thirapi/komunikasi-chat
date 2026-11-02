import { RoomWithParticipantsDTO } from "@/lib/entities/models/room.model";
import { IRoomRepository } from "../../repositories/room.repository.interface";
import { avatarService } from "@/lib/infrastructure/services/avatar.service";
import type { IUserBlockRepository } from "../../repositories/user-block.repository.interface";
import { withoutOthersReadPositions } from "./apply-room-privacy";

export class StartDirectMessageUseCase {
  constructor(
    private roomRepository: IRoomRepository,
    private blockRepository?: Pick<IUserBlockRepository, "getStatus">,
  ) {}

  async execute(
    currentUserId: string,
    targetUserId: string
  ): Promise<{ room: RoomWithParticipantsDTO; action: "existing" | "created" }> {
    const existingRooms = await this.roomRepository.getAllRoomsByUserId(currentUserId, {
      isDirect: true,
    });

    const existingRoom = existingRooms?.find((room) =>
      room.participants.some((p) => p.user.id === targetUserId)
    );

    if (existingRoom) {
      return {
        room: withoutOthersReadPositions(existingRoom, currentUserId),
        action: "existing",
      };
    }

    // An existing DM still opens (its history stays readable, as in WhatsApp);
    // a new one cannot be started across a block in either direction.
    if (this.blockRepository) {
      const status = await this.blockRepository.getStatus(currentUserId, targetUserId);
      if (status.iBlocked || status.blockedMe) {
        throw new Error("Tidak bisa memulai percakapan dengan pengguna ini");
      }
    }

    const avatar = avatarService.generateAvatarUrl(`${currentUserId}-${targetUserId}`);

    const newRoom = await this.roomRepository.createRoom(
      `${currentUserId}-${targetUserId}`,
      true,
      [currentUserId, targetUserId],
      avatar,
      undefined,
      false
    );

    return {
      room: withoutOthersReadPositions(newRoom, currentUserId),
      action: "created",
    };
  }
}
