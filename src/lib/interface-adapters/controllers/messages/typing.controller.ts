import { TypingUseCase } from "@/lib/application/use-cases/messages/typing.use-case";
import { UserRepository } from "@/lib/infrastructure/repositories/user.repository";
import { RoomRepository } from "@/lib/infrastructure/repositories/room.repository";
import { PusherService } from "@/lib/infrastructure/services/pusher.service";
import { z } from "zod";

import { db } from "@/lib/db";

const pusherService = new PusherService();
const userRepository = new UserRepository(db);
const typingUseCase = new TypingUseCase(pusherService, userRepository, new RoomRepository(db));

const formSchema = z.object({
  userId: z.string(),
  roomId: z.string(),
});

export const startTypingController = async (userId: string, roomId: string) => {
  const parsedMessage = formSchema.safeParse({
    userId,
    roomId,
  });
  if (!parsedMessage.success) {
    const errorField = {
      ...parsedMessage.error?.flatten().fieldErrors,
    };
    throw new Error("Invalid input: " + JSON.stringify(errorField));
  }

  await typingUseCase.startTyping(userId, roomId);
};

export const stopTypingController = async (userId: string, roomId: string) => {
  const parsedMessage = formSchema.safeParse({
    userId,
    roomId,
  });
  if (!parsedMessage.success) {
    const errorField = {
      ...parsedMessage.error?.flatten().fieldErrors,
    };
    throw new Error("Invalid input: " + JSON.stringify(errorField));
  }

  await typingUseCase.stopTyping(userId, roomId);
};