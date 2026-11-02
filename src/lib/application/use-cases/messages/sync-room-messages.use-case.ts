import { MessageWithUserDTO } from "@/lib/entities/models/message.model";
import { IMessageRepository } from "../../repositories/message.repository.interface";
import type { IHiddenMessageRepository } from "../../repositories/hidden-message.repository.interface";

/** Page size for a room's newest messages (same as the regular first page). */
export const ROOM_PAGE_SIZE = 50;

/**
 * Cursor slack. Message.createdAt comes from the DB clock and updatedAt from
 * the app server clock, and a write may commit slightly after it was stamped.
 * Handing back a cursor a little in the past only re-sends a few rows the
 * client already has (it dedupes by id); a cursor too far ahead would lose
 * changes for good.
 */
const CURSOR_SLACK_MS = 10_000;

export type RoomSync =
  | { mode: "full"; messages: MessageWithUserDTO[]; cursor: Date }
  | { mode: "delta"; changed: MessageWithUserDTO[]; deletedIds: string[]; cursor: Date };

/**
 * What a client needs to bring its cached copy of a room up to date.
 *
 * With a cursor from a previous sync it gets only what was created or changed
 * since (edits, deletions and reactions all bump updatedAt), the way Telegram
 * Web catches a cached chat up instead of re-downloading it. Without one, or
 * when too much changed to patch, it gets the newest page in full.
 */
export class SyncRoomMessagesUseCase {
  constructor(
    private messageRepository: IMessageRepository,
    private hiddenRepository?: Pick<IHiddenMessageRepository, "hiddenSince">,
  ) {}

  /** `viewerId`: leave out what that user hid ("delete for me"). */
  async execute(roomId: string, since?: Date | null, viewerId?: string): Promise<RoomSync> {
    const cursor = new Date(Date.now() - CURSOR_SLACK_MS);

    if (since) {
      const delta = await this.messageRepository.getRoomChangesSince(roomId, since, ROOM_PAGE_SIZE, viewerId);
      if (!delta.overflow) {
        // Messages hidden on another device since the cursor are removals too.
        const hidden =
          viewerId && this.hiddenRepository ? await this.hiddenRepository.hiddenSince(viewerId, roomId, since) : [];
        const deletedIds = [...new Set([...delta.deletedIds, ...hidden])];
        return { mode: "delta", changed: delta.changed, deletedIds, cursor };
      }
    }

    const messages = await this.messageRepository.getMessagesByRoomId(roomId, ROOM_PAGE_SIZE, undefined, undefined, viewerId);
    return { mode: "full", messages, cursor };
  }
}
