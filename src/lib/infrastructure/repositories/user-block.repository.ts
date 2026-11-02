import { db } from "@/lib/db";
import { and, eq, or } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { userBlocks } from "@/lib/infrastructure/drizzle/schema";
import { IUserBlockRepository } from "@/lib/application/repositories/user-block.repository.interface";
import { BlockStatus } from "@/lib/entities/models/block.model";

export class UserBlockRepository implements IUserBlockRepository {
  constructor(private client: typeof db) {}

  async block(blockerId: string, blockedId: string): Promise<void> {
    await this.client
      .insert(userBlocks)
      .values({ id: createId(), blockerId, blockedId })
      .onConflictDoNothing();
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    await this.client
      .delete(userBlocks)
      .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)));
  }

  async getStatus(viewerId: string, otherId: string): Promise<BlockStatus> {
    const rows = await this.client
      .select({ blockerId: userBlocks.blockerId })
      .from(userBlocks)
      .where(
        or(
          and(eq(userBlocks.blockerId, viewerId), eq(userBlocks.blockedId, otherId)),
          and(eq(userBlocks.blockerId, otherId), eq(userBlocks.blockedId, viewerId)),
        ),
      );
    return {
      iBlocked: rows.some((r) => r.blockerId === viewerId),
      blockedMe: rows.some((r) => r.blockerId === otherId),
    };
  }
}
