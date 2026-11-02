import { db } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { messages, pollOptions, polls, pollVotes } from "@/lib/infrastructure/drizzle/schema";
import { IPollRepository, PollInfo } from "@/lib/application/repositories/poll.repository.interface";

export class PollRepository implements IPollRepository {
  constructor(private client: typeof db) {}

  async getPoll(pollId: string): Promise<PollInfo | null> {
    const [row] = await this.client
      .select({
        id: polls.id,
        messageId: polls.messageId,
        allowMultiple: polls.allowMultiple,
        roomId: messages.roomId,
        isDeleted: messages.isDeleted,
      })
      .from(polls)
      .innerJoin(messages, eq(messages.id, polls.messageId))
      .where(eq(polls.id, pollId));
    if (!row) return null;
    const options = await this.client.select({ id: pollOptions.id }).from(pollOptions).where(eq(pollOptions.pollId, pollId));
    return {
      id: row.id,
      messageId: row.messageId,
      roomId: row.roomId,
      allowMultiple: row.allowMultiple,
      optionIds: options.map((o) => o.id),
      messageDeleted: row.isDeleted,
    };
  }

  async setVotes(pollId: string, userId: string, optionIds: string[]): Promise<void> {
    await this.client.transaction(async (tx) => {
      await tx.delete(pollVotes).where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, userId)));
      if (optionIds.length > 0) {
        await tx.insert(pollVotes).values(optionIds.map((optionId) => ({ id: createId(), pollId, optionId, userId })));
      }
    });
  }
}
