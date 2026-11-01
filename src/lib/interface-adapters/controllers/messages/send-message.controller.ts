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
    new UpstashIdempotencyStore()
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