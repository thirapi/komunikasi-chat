import { UpdateLastReadAtUseCase } from "@/lib/application/use-cases/rooms/update-last-read-at.use-case";
import { RoomRepository } from "@/lib/infrastructure/repositories/room.repository";
import { PusherService } from "@/lib/infrastructure/services/pusher.service";
import { UserPrivacyRepository } from "@/lib/infrastructure/repositories/user-privacy.repository";
import { db } from "@/lib/db";

const roomRepository = new RoomRepository(db);
const pusherService = new PusherService();
const updateLastReadAtUseCase = new UpdateLastReadAtUseCase(roomRepository, pusherService, new UserPrivacyRepository(db));

export async function updateLastReadAtController(
  userId: string,
  roomId: string,
  messageId: string,
  lastReadAt?: Date
): Promise<void> {
  if (!userId || !roomId || !messageId) {
    throw new Error("Invalid input parameters");
  }

  await updateLastReadAtUseCase.execute(userId, roomId, messageId, lastReadAt);
}
