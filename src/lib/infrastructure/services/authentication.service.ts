import {
    encodeBase32LowerCaseNoPadding,
    encodeHexLowerCase,
} from "@oslojs/encoding";
import { sha256 } from "@oslojs/crypto/sha2";
import { IUserRepository } from "@/lib/application/repositories/user.repository.interface";
import { ISessionRepository } from "@/lib/application/repositories/session.repository.interface";
import { SessionRecord, SessionDTO } from "@/lib/entities/models/session.model";
import { AuthenticationError } from "@/lib/entities/errors/common";
import { IActivityLogRepository } from "@/lib/application/repositories/activity-log.repository.interface";
import { getRedis } from "@/lib/redis";
import { defer } from "@/lib/defer";

/**
 * Audit metadata, either ready or computed lazily. A function is resolved only
 * inside the deferred log write, so slow enrichment (IP geolocation) never sits
 * on the request path.
 */
export type AuthMetadata = Record<string, any> | (() => Promise<Record<string, any>>);

const SESSION_ACTIVITY_LOG_TTL_SECONDS = 60 * 60 * 24; // 24 hours

export class AuthenticationService {
    private SESSION_EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 30;
    private SESSION_REFRESH_TIME = 1000 * 60 * 60 * 24 * 15;

    constructor(
        private sessionRepository: ISessionRepository,
        private userRepository: IUserRepository,
        private activityLogRepository: IActivityLogRepository
    ) { }

    generateSessionToken(): string {
        const bytes = new Uint8Array(20);
        crypto.getRandomValues(bytes);
        const token = encodeBase32LowerCaseNoPadding(bytes);
        return token;
    }

    async createSession(token: string, userId: string): Promise<SessionRecord> {
        const sessionId = encodeHexLowerCase(
            sha256(new TextEncoder().encode(token))
        );
        const session: SessionRecord = {
            id: sessionId,
            userId: userId,
            expiresAt: new Date(Date.now() + this.SESSION_EXPIRATION_TIME),
            createdAt: new Date(),
        };
        // insertSession reports failure by returning false rather than
        // throwing; ignoring that used to hand the browser a cookie for a
        // session that did not exist, so the very next page bounced to login.
        const inserted = await this.sessionRepository
            .insertSession(session)
            .catch(() => false);
        if (!inserted) {
            throw new AuthenticationError("Error creating session!");
        }
        return session;
    }

    async validateSession(token: string, context?: { ip?: string; userAgent?: string; metadata?: Record<string, any> }): Promise<SessionDTO> {
        const sessionId = encodeHexLowerCase(
            sha256(new TextEncoder().encode(token))
        );

        // This runs on every page render, server action and Pusher auth, so it
        // is kept to a single read. Everything else (expiry cleanup, sliding
        // refresh, the daily activity log) is a write the caller does not need
        // to wait for, and is deferred until after the response.
        const found = await this.sessionRepository.findBySessionIdWithUser(sessionId);

        if (!found) {
            return { session: null, user: null };
        }

        const { session: sessionData, user: userData } = found;
        const now = Date.now();

        if (now >= sessionData.expiresAt.getTime()) {
            defer(() => this.sessionRepository.deleteSession(sessionId));
            return { session: null, user: null };
        }

        if (now >= sessionData.expiresAt.getTime() - this.SESSION_REFRESH_TIME) {
            sessionData.expiresAt = new Date(now + this.SESSION_EXPIRATION_TIME);
            const refreshed = { ...sessionData };
            defer(() => this.sessionRepository.updateSession(refreshed));
        }

        // Log session activity at most once per 24 hours per user. A Redis
        // SETNX with a 24h TTL is the throttle; if Redis is unreachable we fall
        // back to logging so audit history is never silently lost.
        defer(async () => {
            let shouldLog = true;
            try {
                const claimed = await getRedis().set(
                    `activity:session_active:${userData.id}`,
                    "1",
                    { ex: SESSION_ACTIVITY_LOG_TTL_SECONDS, nx: true }
                );
                shouldLog = claimed === "OK";
            } catch (e) {
                console.warn("Session activity throttle unavailable, logging event", e);
            }
            if (!shouldLog) return;
            await this.activityLogRepository.insertLog({
                id: crypto.randomUUID(),
                userId: userData.id,
                category: "activity",
                action: "session_active",
                metadata: context?.metadata,
                ipAddress: context?.ip,
                userAgent: context?.userAgent,
                createdAt: new Date(),
            });
        });

        return { session: sessionData, user: userData };
    }

    async invalidateSession(sessionId: string): Promise<void> {
        await this.sessionRepository.deleteSession(sessionId);
    }

    /**
     * Record an audit event. The write is deferred until after the response,
     * so callers can `await` this without paying for the insert (or for lazy
     * metadata such as geolocation) on the request path.
     */
    async logEvent(params: {
        userId: string | null;
        category: "auth" | "security" | "activity";
        action: string;
        metadata?: AuthMetadata;
        ip?: string;
        userAgent?: string;
    }): Promise<void> {
        defer(async () => {
            const metadata =
                typeof params.metadata === "function"
                    ? await params.metadata().catch(() => undefined)
                    : params.metadata;
            await this.activityLogRepository.insertLog({
                id: crypto.randomUUID(),
                userId: params.userId,
                category: params.category,
                action: params.action,
                metadata,
                ipAddress: params.ip,
                userAgent: params.userAgent,
                createdAt: new Date(),
            });
        });
    }
}
