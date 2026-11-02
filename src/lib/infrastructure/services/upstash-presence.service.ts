// src/lib/infrastructure/services/upstash-presence.service.ts
import { getRedis } from "@/lib/redis";
import { IPresenceService } from "@/lib/application/services/presence.service.interface";

const PRESENCE_KEY_PREFIX = "presence:";
const PRESENCE_INDEX_KEY = "presence:online";
const DEFAULT_TTL = 60; // 60 seconds

export class UpstashPresenceService implements IPresenceService {
    private redis = getRedis();
    private readonly PRESENCE_KEY_PREFIX = PRESENCE_KEY_PREFIX;
    private readonly PRESENCE_INDEX_KEY = PRESENCE_INDEX_KEY;
    private readonly DEFAULT_TTL = DEFAULT_TTL;

    async setOnline(userId: string, ttl: number = this.DEFAULT_TTL): Promise<void> {
        await this.redis
            .multi()
            .set(`${this.PRESENCE_KEY_PREFIX}${userId}`, "online", { ex: ttl })
            .sadd(this.PRESENCE_INDEX_KEY, userId)
            .exec();
    }

    async claimThrottle(key: string, ttlSeconds: number): Promise<boolean> {
        const res = await this.redis.set(`throttle:${key}`, "1", { nx: true, ex: ttlSeconds });
        return res === "OK";
    }

    async setOffline(userId: string): Promise<void> {
        await this.redis
            .multi()
            .del(`${this.PRESENCE_KEY_PREFIX}${userId}`)
            .srem(this.PRESENCE_INDEX_KEY, userId)
            .exec();
    }

    async getOnlineUserIds(): Promise<string[]> {
        // `KEYS presence:*` is O(keyspace) and blocks the Redis server, and this
        // runs on every page load. The candidate ids come from an index set
        // instead, and the remaining TTL keys are verified in one pipeline so a
        // client that vanished without sending "offline" is pruned.
        const candidates = await this.redis.smembers<string[]>(this.PRESENCE_INDEX_KEY);
        if (candidates.length === 0) return [];

        const pipeline = this.redis.pipeline();
        for (const userId of candidates) {
            pipeline.get(`${this.PRESENCE_KEY_PREFIX}${userId}`);
        }
        const statuses = await pipeline.exec<(string | null)[]>();

        const online: string[] = [];
        const stale: string[] = [];
        candidates.forEach((userId, index) => {
            if (statuses[index] === "online") online.push(userId);
            else stale.push(userId);
        });

        if (stale.length > 0) {
            // Fire-and-forget: the index entry is already TTL-key-less, so a
            // failed prune just means the next read prunes it again.
            this.redis.srem(this.PRESENCE_INDEX_KEY, ...stale).catch(() => {});
        }

        return online;
    }

    async isUserOnline(userId: string): Promise<boolean> {
        const status = await this.redis.get(`${this.PRESENCE_KEY_PREFIX}${userId}`);
        return status === "online";
    }
}
