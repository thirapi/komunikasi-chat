import { IRoomRepository } from "../../repositories/room.repository.interface";
import { canModerate } from "@/lib/entities/models/room.model";
import { roleIn } from "./room-roles";

export class UpdateRoomUseCase {
  constructor(private roomRepository: IRoomRepository) {}

  async execute(
    roomId: string,
    requesterId: string,
    data: { name?: string; description?: string; isPublic?: boolean; avatar?: string; banner?: string }
  ): Promise<void> {
    const room = await this.roomRepository.getRoomById(roomId);
    if (!room) throw new Error("Channel tidak ditemukan");

    if (!canModerate(roleIn(room, requesterId))) {
      throw new Error("Hanya pemilik atau admin channel yang dapat mengubah pengaturan ini");
    }

    if (!data.name && data.description === undefined && data.isPublic === undefined && !data.avatar && !data.banner) {
      throw new Error("Tidak ada perubahan yang dikirim");
    }

    await this.roomRepository.updateRoom(roomId, data);
  }
}
