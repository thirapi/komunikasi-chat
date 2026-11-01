import { SyncRoomMessagesUseCase } from "@/lib/application/use-cases/messages/sync-room-messages.use-case";
import { MessageRepository } from "@/lib/infrastructure/repositories/message.repository";
import { db } from "@/lib/db";

const syncRoomMessagesUseCase = new SyncRoomMessagesUseCase(new MessageRepository(db));

export async function syncRoomMessagesController(roomId: string, since?: Date | null) {
  // A cursor from the future (bad client clock or tampering) would hide
  // changes; treat anything unusable as "no cursor" and send a full page.
  const valid = since instanceof Date && !Number.isNaN(since.getTime()) && since.getTime() <= Date.now();
  return syncRoomMessagesUseCase.execute(roomId, valid ? since : null);
}
