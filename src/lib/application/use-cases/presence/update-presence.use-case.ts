// src/lib/application/use-cases/presence/update-presence.use-case.ts
import { IPresenceService } from "../../services/presence.service.interface";
import { IPusherService } from "../../services/pusher.service.interface";
import type { IUserPrivacyRepository } from "../../repositories/user-privacy.repository.interface";

/** Heartbeats come every ~50s; last seen is written at most this often. */
const LAST_SEEN_WRITE_SECONDS = 120;

export class UpdatePresenceUseCase {
    constructor(
        private presenceService: IPresenceService,
        private pusherService: IPusherService,
        private privacyRepository?: Pick<IUserPrivacyRepository, "touchLastSeen">,
    ) { }

    /**
     * Last seen: always on going offline, and from heartbeats at most every
     * two minutes, so a tab that disappears without saying "offline" still
     * leaves a last seen that is at most that stale.
     */
    private async recordLastSeen(userId: string, status: "online" | "offline") {
        if (!this.privacyRepository) return;
        try {
            const write =
                status === "offline" ||
                !this.presenceService.claimThrottle ||
                (await this.presenceService.claimThrottle(`lastseen:${userId}`, LAST_SEEN_WRITE_SECONDS));
            if (write) await this.privacyRepository.touchLastSeen(userId, new Date());
        } catch (err) {
            console.error("[presence] last seen write failed:", err);
        }
    }

    async execute(userId: string, status: "online" | "offline"): Promise<void> {
        const wasOnline = await this.presenceService.isUserOnline(userId);
        await this.recordLastSeen(userId, status);

        if (status === "online") {
            await this.presenceService.setOnline(userId);
            if (!wasOnline) {
                // Broadcast global online status
                await this.pusherService.trigger("global-presence", "user-online", {
                    userId,
                });
            }
        } else {
            await this.presenceService.setOffline(userId);
            if (wasOnline) {
                // Broadcast global offline status
                await this.pusherService.trigger("global-presence", "user-offline", {
                    userId,
                });
            }
        }
    }

    async getOnlineUsers(): Promise<string[]> {
        return await this.presenceService.getOnlineUserIds();
    }
}
