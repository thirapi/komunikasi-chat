import { MessageRepository } from "@/lib/infrastructure/repositories/message.repository";
import { SearchMessagesUseCase } from "@/lib/application/use-cases/messages/search-messages.use-case";
import { db } from "@/lib/db";

const messageRepository = new MessageRepository(db);
const searchMessagesUseCase = new SearchMessagesUseCase(messageRepository);

export const searchMessagesController = async (query: string, roomId?: string, limit?: number, viewerId?: string) => {
  return await searchMessagesUseCase.execute(query, roomId, limit, viewerId);
};
