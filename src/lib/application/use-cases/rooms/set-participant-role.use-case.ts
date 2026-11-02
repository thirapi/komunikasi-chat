import { roomChannel } from "@/lib/pusher/channels";
import { IRoomRepository } from "../../repositories/room.repository.interface";
import { IPusherService } from "../../services/pusher.service.interface";
import { roleIn } from "./room-roles";

/** Only the channel owner appoints and removes admins. */
export class SetParticipantRoleUseCase {
  constructor(
    private roomRepository: Pick<IRoomRepository, "getRoomById" | "setParticipantRole">,
    private pusherService: Pick<IPusherService, "trigger">,
  ) {}

  async execute(requesterId: string, roomId: string, userId: string, role: "admin" | "member"): Promise<void> {
    const room = await this.roomRepository.getRoomById(roomId);
    if (!room) throw new Error("Channel tidak ditemukan");
    if (room.isDirect) throw new Error("Pesan langsung tidak punya admin");
    if (room.ownerId !== requesterId) throw new Error("Hanya pemilik channel yang dapat mengatur admin");
    const target = roleIn(room, userId);
    if (!target) throw new Error("Pengguna bukan anggota channel ini");
    if (target === "owner") throw new Error("Peran pemilik tidak bisa diubah");
    await this.roomRepository.setParticipantRole(roomId, userId, role);
    await this.pusherService.trigger(roomChannel(roomId), "roles-changed", { userId, role });
  }
}
