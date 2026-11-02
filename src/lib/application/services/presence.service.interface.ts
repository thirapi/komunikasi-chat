// src/lib/application/services/presence.service.interface.ts

export interface IPresenceService {
    setOnline(userId: string, ttl?: number): Promise<void>;
    setOffline(userId: string): Promise<void>;
    getOnlineUserIds(): Promise<string[]>;
    isUserOnline(userId: string): Promise<boolean>;
    /** True at most once per `ttlSeconds` per key (Redis SET NX EX). */
    claimThrottle?(key: string, ttlSeconds: number): Promise<boolean>;
}
