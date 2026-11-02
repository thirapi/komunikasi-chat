import { db } from "@/lib/db";
import { and, eq, gt } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { hiddenMessages, messages } from "@/lib/infrastructure/drizzle/schema";
import { IHiddenMessageRepository } from "@/lib/application/repositories/hidden-message.repository.interface";

export class HiddenMessageRepository implements IHiddenMessageRepository {
  constructor(private client: typeof db) {}

  async hide(userId: string, messageId: string): Promise<void> {
    await this.client.insert(hiddenMessages).values({ id: createId(), userId, messageId }).onConflictDoNothing();
  }

  async hiddenSince(userId: string, roomId: string, since: Date): Promise<string[]> {
    const rows = await this.client
      .select({ id: hiddenMessages.messageId })
      .from(hiddenMessages)
      .innerJoin(messages, eq(messages.id, hiddenMessages.messageId))
      .where(and(eq(hiddenMessages.userId, userId), eq(messages.roomId, roomId), gt(hiddenMessages.createdAt, since)));
    return rows.map((r) => r.id);
  }
}
