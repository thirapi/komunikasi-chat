import { IRoomRepository } from "../../repositories/room.repository.interface";
import { IUserRepository } from "../../repositories/user.repository.interface";
import { createId } from "@paralleldrive/cuid2";
import { canModerate } from "@/lib/entities/models/room.model";
import { roleIn } from "./room-roles";

export class InviteToRoomUseCase {
  constructor(
    private roomRepository: IRoomRepository,
    private userRepository: IUserRepository
  ) {}

  async searchInvitableUsers(
    roomId: string,
    query: string
  ): Promise<{ id: string; username: string; avatar: string }[]> {
    // Membership set only: getRoomById fanned out over rooms -> participants ->
    // users -> userRoles -> roles on every keystroke of the invite search.
    const [participantIds, users] = await Promise.all([
      this.roomRepository.getParticipantIds(roomId),
      this.userRepository.searchUsers(query, 10),
    ]);

    const existing = new Set(participantIds);

    // Filter out users already in the room
    return users.filter((u) => !existing.has(u.id));
  }

  async execute(
    roomId: string,
    requesterId: string,
    targetUserId: string
  ): Promise<void> {
    const room = await this.roomRepository.getRoomById(roomId);
    if (!room) throw new Error("Channel tidak ditemukan");

    // Private channels: the owner and admins invite.
    if (!room.isPublic && !canModerate(roleIn(room, requesterId))) {
      throw new Error("Hanya pemilik atau admin channel yang dapat mengundang anggota baru");
    }

    // Check if user is already a member
    const isAlreadyMember = room.participants.some((p) => p.user.id === targetUserId);
    if (isAlreadyMember) {
      throw new Error("User sudah menjadi anggota channel ini");
    }

    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) throw new Error("User tidak ditemukan");

    await this.roomRepository.addParticipant(roomId, targetUserId);
  }
}
