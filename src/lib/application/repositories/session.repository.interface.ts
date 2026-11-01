import { SessionLogRecord, SessionRecord } from "@/lib/entities/models/session.model";
import { UserRecord } from "@/lib/entities/models/user.model";

export interface ISessionRepository {
    getAllSessions(limit?: number): Promise<SessionLogRecord[]>;
    findBySessionId(sessionId: string): Promise<SessionRecord | null>;
    /** Session plus its owner (without the password hash) in one round-trip. */
    findBySessionIdWithUser(
        sessionId: string
    ): Promise<{ session: SessionRecord; user: Omit<UserRecord, "password"> } | null>;
    insertSession(sessionData: SessionRecord): Promise<boolean>;
    deleteSession(sessionId: string): Promise<void>;
    updateSession(sessionData: SessionRecord): Promise<void>;
}
