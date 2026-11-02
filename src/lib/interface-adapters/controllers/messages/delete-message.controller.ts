import { MessageRepository } from "@/lib/infrastructure/repositories/message.repository";
import { RoomRepository } from "@/lib/infrastructure/repositories/room.repository";
import { DeleteMessageUseCase } from "@/lib/application/use-cases/messages/delete-message.use-case";
import { InputParsedError } from "@/lib/entities/errors/common";
import { z } from "zod";
import { PusherService } from "@/lib/infrastructure/services/pusher.service";
import { CloudflareR2Service } from "@/lib/infrastructure/services/cloudflare-r2.service";
import { db } from "@/lib/db";

const messageRepository = new MessageRepository(db);
const roomRepository = new RoomRepository(db);
const pusherService = new PusherService();

// The R2 service throws when its env vars are missing; deleting a message
// must keep working then, only without removing the files from storage.
function createStorage() {
    try {
        return new CloudflareR2Service();
    } catch (err) {
        console.warn("[delete-message] storage cleanup disabled:", (err as Error).message);
        return undefined;
    }
}

const deleteMessageUseCase = new DeleteMessageUseCase(
    messageRepository,
    roomRepository,
    pusherService,
    createStorage(),
);

const schema = z.object({
    messageId: z.string(),
});

export const deleteMessageController = async (

    userId: string,
    messageId: string
) => {
    const parsed = schema.safeParse({ messageId });

    if (!parsed.success) {
        throw new InputParsedError("Invalid input", parsed.error.flatten().fieldErrors);
    }

    return await deleteMessageUseCase.execute(userId, parsed.data.messageId);
};
