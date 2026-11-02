import { StartDirectMessageUseCase } from "@/lib/application/use-cases/rooms/start-direct-message.use-case";
import { RoomRepository } from "@/lib/infrastructure/repositories/room.repository";
import { UserBlockRepository } from "@/lib/infrastructure/repositories/user-block.repository";
import { db } from "@/lib/db";
import { z } from "zod";

const roomRepository = new RoomRepository(db);
const startDirectMessageUseCase = new StartDirectMessageUseCase(roomRepository, new UserBlockRepository(db));

const schema = z.object({
  currentUserId: z.string().min(1),
  targetUserId: z.string().min(1),
});

export const startDirectMessageController = async (
  currentUserId: string,
  targetUserId: string
) => {
  const parsed = schema.safeParse({ currentUserId, targetUserId });

  if (!parsed.success) {
    throw new Error("Invalid input parameters");
  }

  return await startDirectMessageUseCase.execute(
    parsed.data.currentUserId,
    parsed.data.targetUserId
  );
};
