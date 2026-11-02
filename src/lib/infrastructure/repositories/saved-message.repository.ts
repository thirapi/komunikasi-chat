import { db } from "@/lib/db";
import { and, desc, eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { messages, roomParticipants, rooms, savedMessages, users, attachments } from "@/lib/infrastructure/drizzle/schema";
import { ISavedMessageRepository } from "@/lib/application/repositories/saved-message.repository.interface";
import { SavedMessageDTO } from "@/lib/entities/models/saved-message.model";

export class SavedMessageRepository implements ISavedMessageRepository {
  constructor(private client: typeof db) {}

  async isSaved(userId: string, messageId: string): Promise<boolean> {
    const row = await this.client.query.savedMessages.findFirst({
      where: and(eq(savedMessages.userId, userId), eq(savedMessages.messageId, messageId)),
      columns: { id: true },
    });
    return !!row;
  }

  async save(userId: string, messageId: string): Promise<void> {
    await this.client.insert(savedMessages).values({ id: createId(), userId, messageId }).onConflictDoNothing();
  }

  async unsave(userId: string, messageId: string): Promise<void> {
    await this.client
      .delete(savedMessages)
      .where(and(eq(savedMessages.userId, userId), eq(savedMessages.messageId, messageId)));
  }

  async list(userId: string, limit: number): Promise<SavedMessageDTO[]> {
    const rows = await this.client
      .select({
        messageId: messages.id,
        roomId: messages.roomId,
        roomName: rooms.name,
        isDirect: rooms.isDirect,
        content: messages.content,
        username: users.username,
        name: users.name,
        avatar: users.avatar,
        createdAt: messages.createdAt,
        savedAt: savedMessages.createdAt,
      })
      .from(savedMessages)
      .innerJoin(messages, eq(messages.id, savedMessages.messageId))
      .innerJoin(rooms, eq(rooms.id, messages.roomId))
      // Still a member: leaving a room takes its saved messages out of view.
      .innerJoin(roomParticipants, and(eq(roomParticipants.roomId, messages.roomId), eq(roomParticipants.userId, userId)))
      .innerJoin(users, eq(users.id, messages.userId))
      .where(and(eq(savedMessages.userId, userId), eq(messages.isDeleted, false)))
      .orderBy(desc(savedMessages.createdAt))
      .limit(limit);

    const firstAttachment = new Map<string, string>();
    for (const r of rows) {
      if (r.content.trim()) continue;
      const a = await this.client.query.attachments.findFirst({
        where: eq(attachments.messageId, r.messageId),
        columns: { fileType: true },
      });
      if (a) firstAttachment.set(r.messageId, a.fileType);
    }

    return rows.map((r) => ({
      messageId: r.messageId,
      roomId: r.roomId,
      roomName: r.roomName,
      isDirect: r.isDirect,
      content: r.content.length > 300 ? `${r.content.slice(0, 300)}…` : r.content,
      user: { username: r.username, name: r.name, avatar: r.avatar },
      createdAt: r.createdAt,
      savedAt: r.savedAt,
      attachmentType: firstAttachment.get(r.messageId) ?? null,
    }));
  }

  async listIds(userId: string, limit: number): Promise<string[]> {
    const rows = await this.client
      .select({ messageId: savedMessages.messageId })
      .from(savedMessages)
      .where(eq(savedMessages.userId, userId))
      .orderBy(desc(savedMessages.createdAt))
      .limit(limit);
    return rows.map((r) => r.messageId);
  }
}
