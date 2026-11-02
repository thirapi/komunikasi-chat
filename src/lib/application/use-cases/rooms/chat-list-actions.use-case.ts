import { IRoomRepository } from "../../repositories/room.repository.interface";
import type { IMessageRepository } from "../../repositories/message.repository.interface";
import { IPusherService } from "../../services/pusher.service.interface";

/** WhatsApp pins 3 chats, Telegram 5. */
export const MAX_PINNED_CHATS = 5;

export class ChatListError extends Error {}

/**
 * Per-user chat list actions: pin a chat to the top (at most 5, most recently
 * pinned first) and mark a chat as unread (a dot until it is opened, as in
 * WhatsApp and Telegram). The user's other devices follow along.
 */
export class ChatListActionsUseCase {
  constructor(
    private roomRepository: Pick<
      IRoomRepository,
      "setChatPinned" | "countPinnedChats" | "setMarkedUnread" | "updateLastReadAt" | "getLastReadAt"
    >,
    private pusherService: Pick<IPusherService, "triggerToUsers">,
    private messageRepository?: Pick<IMessageRepository, "getMessagesByRoomId">,
  ) {}

  /**
   * "Mark as read" from the chat list: read up to the newest message without
   * opening the chat, and clear a manual unread mark.
   */
  async markRead(userId: string, roomId: string): Promise<void> {
    await this.roomRepository.setMarkedUnread(userId, roomId, false);
    const [latest] = (await this.messageRepository?.getMessagesByRoomId(roomId, 1)) ?? [];
    if (latest) {
      const current = await this.roomRepository.getLastReadAt(userId, roomId);
      const at = new Date(latest.createdAt);
      if (!current.at || current.at < at) await this.roomRepository.updateLastReadAt(userId, roomId, latest.id, at);
    }
    await this.pusherService.triggerToUsers([userId], "room-marked-read", { roomId });
  }

  async setPinned(userId: string, roomId: string, pinned: boolean): Promise<Date | null> {
    if (pinned && (await this.roomRepository.countPinnedChats(userId)) >= MAX_PINNED_CHATS) {
      throw new ChatListError(`Maksimal ${MAX_PINNED_CHATS} chat disematkan. Lepas salah satu dulu.`);
    }
    const pinnedAt = pinned ? new Date() : null;
    await this.roomRepository.setChatPinned(userId, roomId, pinnedAt);
    await this.pusherService.triggerToUsers([userId], "chat-list-changed", { roomId, pinnedAt });
    return pinnedAt;
  }

  async setMarkedUnread(userId: string, roomId: string, markedUnread: boolean): Promise<void> {
    await this.roomRepository.setMarkedUnread(userId, roomId, markedUnread);
    await this.pusherService.triggerToUsers([userId], "chat-list-changed", { roomId, markedUnread });
  }
}
