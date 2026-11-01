import { db } from "@/lib/db";
import { sessions } from "@/lib/infrastructure/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { ISessionRepository } from "@/lib/application/repositories/session.repository.interface";
import { SessionLogRecord, SessionRecord } from "@/lib/entities/models/session.model";
import { UserRecord } from "@/lib/entities/models/user.model";

export class SessionRepository implements ISessionRepository {
  constructor(private client: typeof db) { }

  async getAllSessions(limit = 500): Promise<SessionLogRecord[]> {
    const allSessions = await this.client.query.sessions.findMany({
      orderBy: [desc(sessions.createdAt)],
      // Mirrors activity-log.findAll: the admin table paginates client-side, so
      // the read is bounded to a recent window rather than the whole table.
      limit,
      with: {
        // The session log renders only the owner's username — do not ship the
        // bcrypt `password` column with every session row.
        user: {
          columns: {
            id: true,
            username: true,
          },
        },
      },
    });
    return allSessions as unknown as SessionLogRecord[];
  }

  async insertSession(sessionData: SessionRecord): Promise<boolean> {
    try {
      await this.client.insert(sessions).values(sessionData);
      return true;
    } catch (err) {
      console.error("Error inserting session:", err);
      return false;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.client.delete(sessions).where(eq(sessions.id, sessionId));
  }

  async findBySessionId(sessionId: string): Promise<SessionRecord | null> {
    try {
      const session = await this.client.query.sessions.findFirst({
        where: eq(sessions.id, sessionId),
      });
      return session as SessionRecord | null;
    } catch (err) {
      return null;
    }
  }

  async findBySessionIdWithUser(
    sessionId: string
  ): Promise<{ session: SessionRecord; user: Omit<UserRecord, "password"> } | null> {
    // One query (session JOIN user) instead of two sequential round-trips on
    // every authenticated request. The bcrypt hash is excluded: nothing that
    // consumes a session needs it, and it used to ride along in every
    // SessionDTO despite the type saying otherwise.
    try {
      const row = await this.client.query.sessions.findFirst({
        where: eq(sessions.id, sessionId),
        with: {
          user: {
            columns: { password: false },
          },
        },
      });
      if (!row || !row.user) return null;
      const { user, ...session } = row;
      return { session: session as SessionRecord, user: user as Omit<UserRecord, "password"> };
    } catch (err) {
      console.error("Error finding session:", err);
      return null;
    }
  }

  async updateSession(sessionData: SessionRecord): Promise<void> {
    await this.client
      .update(sessions)
      .set(sessionData)
      .where(eq(sessions.id, sessionData.id));
  }
}
