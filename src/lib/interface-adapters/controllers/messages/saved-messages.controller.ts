import { z } from "zod";
import { db } from "@/lib/db";
import { SavedMessageRepository } from "@/lib/infrastructure/repositories/saved-message.repository";
import { MessageRepository } from "@/lib/infrastructure/repositories/message.repository";
import { RoomRepository } from "@/lib/infrastructure/repositories/room.repository";
import { SavedMessagesUseCase } from "@/lib/application/use-cases/messages/saved-messages.use-case";

const savedMessagesUseCase = new SavedMessagesUseCase(
  new SavedMessageRepository(db),
  new MessageRepository(db),
  new RoomRepository(db),
);

export async function toggleSavedMessageController(userId: string, messageId: string) {
  const parsed = z.string().min(1).safeParse(messageId);
  if (!parsed.success) throw new Error("Input tidak valid");
  return savedMessagesUseCase.toggle(userId, parsed.data);
}

export async function listSavedMessagesController(userId: string) {
  return savedMessagesUseCase.list(userId);
}

export async function listSavedMessageIdsController(userId: string) {
  return savedMessagesUseCase.ids(userId);
}
