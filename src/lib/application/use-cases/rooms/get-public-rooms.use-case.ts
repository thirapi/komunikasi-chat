import { RoomWithParticipantsDTO } from "@/lib/entities/models/room.model";
import { IRoomRepository } from "../../repositories/room.repository.interface";
import { withoutOthersReadPositions } from "./apply-room-privacy";

export class GetPublicRoomsUseCase {
  constructor(private roomRepository: IRoomRepository) {}
  async execute(userId: string): Promise<RoomWithParticipantsDTO[]> {
    const rooms = await this.roomRepository.getPublicRooms(userId);
    return rooms.map((r) => withoutOthersReadPositions(r, userId));
  }
}
