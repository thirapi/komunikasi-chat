// src/app/(with-sidebar)/presence.action.ts
"use server";

import { UpstashPresenceService } from "@/lib/infrastructure/services/upstash-presence.service";
import { PusherService } from "@/lib/infrastructure/services/pusher.service";
import { UpdatePresenceUseCase } from "@/lib/application/use-cases/presence/update-presence.use-case";
import { ServerResponse } from "@/lib/entities/models/response.model";
import { AuthorizationError, getActor } from "@/lib/auth/actor";
import { UserPrivacyRepository } from "@/lib/infrastructure/repositories/user-privacy.repository";
import { db } from "@/lib/db";

const presenceService = new UpstashPresenceService();
const pusherService = new PusherService();
const updatePresenceUseCase = new UpdatePresenceUseCase(presenceService, pusherService, new UserPrivacyRepository(db));

export const updatePresenceAction = async (
    userId: string,
    status: "online" | "offline"
): Promise<ServerResponse<null>> => {
    try {
        const actor = await getActor();
        // Presence is about the person at the keyboard; an admin viewing as
        // someone must not mark that user online.
        if (actor.isImpersonating) return { status: "success", data: null, error: null };
        if (userId && userId !== actor.sessionUserId) throw new AuthorizationError();
        await updatePresenceUseCase.execute(actor.sessionUserId, status);
        return {
            status: "success",
            data: null,
            error: null,
        };
    } catch (err: any) {
        return {
            status: "error",
            data: null,
            error: {
                message: err.message,
                type: err.name,
            },
        };
    }
};

export const getOnlineUsersAction = async (): Promise<ServerResponse<string[]>> => {
    try {
        const onlineUserIds = await updatePresenceUseCase.getOnlineUsers();
        return {
            status: "success",
            data: onlineUserIds,
            error: null,
        };
    } catch (err: any) {
        return {
            status: "error",
            data: [] as string[],
            error: {
                message: err.message,
                type: err.name,
            },
        };
    }
};
