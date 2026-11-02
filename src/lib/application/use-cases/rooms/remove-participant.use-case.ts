import { IRoomRepository } from "../../repositories/room.repository.interface";
import { canModerate } from "@/lib/entities/models/room.model";
import { roleIn } from "./room-roles";

export class RemoveParticipantUseCase {
  constructor(private roomRepository: IRoomRepository) {}
  async execute(roomId: string, userId: string, requesterId: string): Promise<void> {
    const room = await this.roomRepository.getRoomById(roomId);
    if (!room) throw new Error("Room not found");

    if (userId !== requesterId) {
      // Removing someone else: the owner may remove anyone but themselves;
      // an admin only plain members (not the owner, not other admins).
      const requesterRole = roleIn(room, requesterId);
      const targetRole = roleIn(room, userId);
      if (!canModerate(requesterRole)) throw new Error("Hanya pemilik atau admin yang dapat mengeluarkan anggota");
      if (targetRole === "owner") throw new Error("Pemilik channel tidak bisa dikeluarkan");
      if (requesterRole === "admin" && targetRole === "admin") {
        throw new Error("Admin tidak bisa mengeluarkan admin lain");
      }
    }

    // Don't allow leaving general-channel if it is mandatory (optional logic)
    if (roomId === "general-channel" && userId === requesterId) {
        // Maybe allow, but usually General is mandatory. Let's allow for now but add a comment.
    }

    await this.roomRepository.removeParticipant(roomId, userId);
  }
}
