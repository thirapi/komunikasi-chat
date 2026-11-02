import { UpdateRoomUseCase } from "@/lib/application/use-cases/rooms/update-room.use-case";
import { DeleteRoomUseCase } from "@/lib/application/use-cases/rooms/delete-room.use-case";
import { SetParticipantRoleUseCase } from "@/lib/application/use-cases/rooms/set-participant-role.use-case";
import { PusherService } from "@/lib/infrastructure/services/pusher.service";
import { RoomRepository } from "@/lib/infrastructure/repositories/room.repository";
import { db } from "@/lib/db";

const roomRepository = new RoomRepository(db);
const updateRoomUseCase = new UpdateRoomUseCase(roomRepository);
const deleteRoomUseCase = new DeleteRoomUseCase(roomRepository);
const setParticipantRoleUseCase = new SetParticipantRoleUseCase(roomRepository, new PusherService());

export const updateRoomController = async (
  roomId: string,
  requesterId: string,
  data: { name?: string; description?: string; isPublic?: boolean; avatar?: string; banner?: string }
) => {
  return await updateRoomUseCase.execute(roomId, requesterId, data);
};

export const deleteRoomController = async (roomId: string, requesterId: string) => {
  return await deleteRoomUseCase.execute(roomId, requesterId);
};

export const setParticipantRoleController = async (
  requesterId: string,
  roomId: string,
  userId: string,
  role: string,
) => {
  if (role !== "admin" && role !== "member") throw new Error("Peran tidak valid");
  return await setParticipantRoleUseCase.execute(requesterId, roomId, userId, role);
};
