import { GetRoomByIdUseCase } from "@/lib/application/use-cases/rooms/get-room-by-id.use-case";
import { RoomRepository } from "@/lib/infrastructure/repositories/room.repository";
import { UserBlockRepository } from "@/lib/infrastructure/repositories/user-block.repository";

import { db } from "@/lib/db";

const roomRepository = new RoomRepository(db);
const getRoomByIdUseCase = new GetRoomByIdUseCase(roomRepository, new UserBlockRepository(db));

export async function getRoomByIdController(roomId: string, viewerId?: string | null) {
  return await getRoomByIdUseCase.execute(roomId, viewerId);
}
