import { GetMessageUseCase } from "@/lib/application/use-cases/messages/get-message.use-case";
import { MessageRepository } from "@/lib/infrastructure/repositories/message.repository";
import { z } from "zod";

import { db } from "@/lib/db";

const messageRepository = new MessageRepository(db);
const getMessageUseCase = new GetMessageUseCase(messageRepository);

const formSchema = z.object({
    roomId: z.string(),
    limit: z.number().optional().default(50),
    before: z.date().optional(),
    after: z.date().optional(),
});
export const getMessageController = async (roomId: string, limit?: number, before?: Date, after?: Date, viewerId?: string) => {
    const message = {
        roomId,
        limit,
        before,
        after,
    };
    const parsedMessage = formSchema.safeParse(message);

    if (!parsedMessage.success) {
        const errorField = {
            ...parsedMessage.error?.flatten().fieldErrors,
        };
        throw new Error(`Invalid input: ${JSON.stringify(errorField)}`);
    }

    return await getMessageUseCase.execute(parsedMessage.data.roomId, parsedMessage.data.limit, parsedMessage.data.before, parsedMessage.data.after, viewerId);
}