import { getRedis } from "@/lib/redis";
import { IIdempotencyStore } from "@/lib/application/services/idempotency.service.interface";

const PENDING = "__pending__";

export class UpstashIdempotencyStore implements IIdempotencyStore {
  private redis = getRedis();

  async claim(key: string, ttlSeconds: number): Promise<string | null> {
    const ok = await this.redis.set(key, PENDING, { nx: true, ex: ttlSeconds });
    if (ok) return null;
    return (await this.redis.get<string>(key)) ?? PENDING;
  }

  async complete(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, value, { ex: ttlSeconds });
  }

  async release(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

export const IDEMPOTENCY_PENDING = PENDING;
