import { MessageRecord } from "@/lib/entities/models/message.model";
import { MessageRepository } from "@/lib/infrastructure/repositories/message.repository";
import { SendMessageUseCase } from "@/lib/application/use-cases/messages/send-message.use-case";
import { InputParsedError } from "@/lib/entities/errors/common";
import { z } from "zod";
import { PusherService } from "@/lib/infrastructure/services/pusher.service";

import { db } from "@/lib/db";
import { RoomRepository } from "@/lib/infrastructure/repositories/room.repository";
import { DiscordNotifierService } from "@/lib/infrastructure/services/discord-notifier.service";
import { PushSubscriptionRepository } from "@/lib/infrastructure/repositories/push-subscription.repository";
import { WebPushService } from "@/lib/infrastructure/services/web-push.service";
import { UpstashIdempotencyStore } from "@/lib/infrastructure/services/upstash-idempotency.service";
import { UserRepository } from "@/lib/infrastructure/repositories/user.repository";
import { UserBlockRepository } from "@/lib/infrastructure/repositories/user-block.repository";
import { ForwardMessageUseCase } from "@/lib/application/use-cases/messages/forward-message.use-case";
import { VotePollUseCase, preparePoll, pollMessageContent } from "@/lib/application/use-cases/messages/polls.use-case";
import { PollRepository } from "@/lib/infrastructure/repositories/poll.repository";
import { HiddenMessageRepository } from "@/lib/infrastructure/repositories/hidden-message.repository";
import { HideMessageUseCase } from "@/lib/application/use-cases/messages/hide-message.use-case";

const messageRepository = new MessageRepository(db);
const roomRepository = new RoomRepository(db)
const pusherService = new PusherService();
const discordNotifierService = new DiscordNotifierService(process.env.DISCORD_WEBHOOK_URL || "");
const pushSubscriptionRepository = new PushSubscriptionRepository();
const webPushService = new WebPushService();

const sendMessageUseCase = new SendMessageUseCase(
    messageRepository,
    roomRepository,
    pusherService,
    discordNotifierService,
    pushSubscriptionRepository,
    webPushService,
    new UpstashIdempotencyStore(),
    new UserBlockRepository(db),
);

const formSchema = z.object({
    content: z.string().max(8000, "Pesan terlalu panjang"),
    roomId: z.string().min(1),
    attachments: z.array(z.object({
        // Only http(s) URLs: these are rendered as <img>/<video>/<a href>.
        url: z.string().url().refine((u) => /^https?:\/\//i.test(u), "URL lampiran tidak valid"),
        key: z.string(),
        fileType: z.string(),
        size: z.number().optional(),
    })).max(10).optional(),
    replyTo: z.string().optional(),
    optimisticId: z.string().max(64).optional(),
}).refine((v) => v.content.trim().length > 0 || (v.attachments?.length ?? 0) > 0, {
    message: "Pesan kosong",
    path: ["content"],
});

export const sendMessageController = async (
    userId: string,
    content: string,
    roomId: string,
    replyTo?: string,
    attachments?: { url: string; key: string; fileType: string; size?: number }[],
    optimisticId?: string
) => {

    const parsedMessage = formSchema.safeParse({
        content,
        roomId,
        attachments,
        replyTo,
        optimisticId,
    });

    if (!parsedMessage.success) {
        const errorField = {
            ...parsedMessage.error?.flatten().fieldErrors,
        };
        throw new InputParsedError("Invalid input: ", errorField);
    }

    return await sendMessageUseCase.execute(
        userId,
        parsedMessage.data.content,
        parsedMessage.data.roomId,
        parsedMessage.data.replyTo,
        parsedMessage.data.attachments,
        parsedMessage.data.optimisticId
    );
};
const forwardMessageUseCase = new ForwardMessageUseCase(messageRepository, roomRepository, new UserRepository(db));

/** Forward a message to up to 5 chats: validate, then a normal send per target. */
export const forwardMessageController = async (
    userId: string,
    messageId: string,
    targetRoomIds: string[],
    comment?: string,
) => {
    const parsed = z.object({
        messageId: z.string().min(1),
        targetRoomIds: z.array(z.string().min(1)).max(20),
        comment: z.string().max(4000).optional(),
    }).safeParse({ messageId, targetRoomIds, comment });
    if (!parsed.success) throw new InputParsedError("Invalid input: ", parsed.error.flatten().fieldErrors);

    const payload = await forwardMessageUseCase.prepare(
        userId,
        parsed.data.messageId,
        parsed.data.targetRoomIds,
        parsed.data.comment,
    );
    const results = await Promise.allSettled(
        payload.targetRoomIds.map(async (roomId) => {
            await sendMessageUseCase.execute(userId, payload.content, roomId, undefined, payload.attachments, undefined, {
                isForwarded: true,
                forwardedFromUserId: payload.forwardedFromUserId,
                poll: payload.poll,
            });
            // The note goes right after the forward, as its own message.
            if (payload.comment) await sendMessageUseCase.execute(userId, payload.comment, roomId);
        }),
    );
    return {
        sent: payload.targetRoomIds.filter((_, i) => results[i].status === "fulfilled"),
        failed: payload.targetRoomIds.filter((_, i) => results[i].status === "rejected"),
    };
};

const votePollUseCase = new VotePollUseCase(new PollRepository(db), roomRepository, messageRepository, pusherService);

/** Create a poll message: validated, then a normal send carrying the poll. */
export const createPollController = async (
    userId: string,
    roomId: string,
    input: { question: string; options: string[]; allowMultiple: boolean },
) => {
    const poll = preparePoll(input);
    return sendMessageUseCase.execute(userId, pollMessageContent(poll.question), roomId, undefined, undefined, undefined, { poll });
};

export const votePollController = async (userId: string, pollId: string, optionIds: string[]) => {
    const parsed = z.object({ pollId: z.string().min(1), optionIds: z.array(z.string().min(1)).max(10) }).safeParse({ pollId, optionIds });
    if (!parsed.success) throw new InputParsedError("Invalid input: ", parsed.error.flatten().fieldErrors);
    return votePollUseCase.execute(userId, parsed.data.pollId, parsed.data.optionIds);
};

const hideMessageUseCase = new HideMessageUseCase(new HiddenMessageRepository(db), messageRepository, roomRepository, pusherService);

/** "Delete for me". */
export const hideMessageController = async (userId: string, messageId: string) => {
    const parsed = z.string().min(1).safeParse(messageId);
    if (!parsed.success) throw new InputParsedError("Invalid input: ", {});
    return hideMessageUseCase.execute(userId, parsed.data);
};
