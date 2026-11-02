import { BlockStatus } from "@/lib/entities/models/block.model";

export interface IUserBlockRepository {
  block(blockerId: string, blockedId: string): Promise<void>;
  unblock(blockerId: string, blockedId: string): Promise<void>;
  /** Relation between viewer and other, both directions in one query. */
  getStatus(viewerId: string, otherId: string): Promise<BlockStatus>;
}
