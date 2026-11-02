import { z } from "zod";
import { db } from "@/lib/db";
import { MessageRepository } from "@/lib/infrastructure/repositories/message.repository";
import { RoomRepository } from "@/lib/infrastructure/repositories/room.repository";
import { PusherService } from "@/lib/infrastructure/services/pusher.service";
import { TogglePinUseCase, MAX_PINS } from "@/lib/application/use-cases/messages/toggle-pin.use-case";

const messageRepository = new MessageRepository(db);
const togglePinUseCase = new TogglePinUseCase(messageRepository, new RoomRepository(db), new PusherService());

export async function togglePinController(userId: string, messageId: string, isAdmin: boolean) {
  const parsed = z.string().min(1).safeParse(messageId);
  if (!parsed.success) throw new Error("Input tidak valid");
  return togglePinUseCase.execute(userId, parsed.data, { isAdmin });
}

export async function getPinnedMessagesController(roomId: string) {
  return messageRepository.getPinnedMessages(roomId, MAX_PINS);
}
