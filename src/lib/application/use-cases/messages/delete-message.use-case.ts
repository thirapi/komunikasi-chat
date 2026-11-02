import { roomChannel } from "@/lib/pusher/channels";
import { IMessageRepository } from "../../repositories/message.repository.interface";
import { IRoomRepository } from "../../repositories/room.repository.interface";
import { IPusherService } from "../../services/pusher.service.interface";
import { FileStorageInterface } from "../../services/file-storage.interface";

export class DeleteMessageUseCase {
  constructor(
    private messageRepository: IMessageRepository,
    private roomRepository: IRoomRepository,
    private pusherService: IPusherService,
    private storage?: Pick<FileStorageInterface, "deleteFile" | "keyFromPublicUrl">,
  ) { }

  /**
   * Remove the deleted message's files from storage, so their public links
   * stop working too (the row itself is only soft-deleted).
   *
   * Attachment rows come from what the client sent when creating the message,
   * so nothing here trusts them blindly:
   * - the key is derived from the URL, which must be one of our own storage
   *   URLs under this message's room folder (`channels/<roomId>/`); avatars,
   *   banners, emoji and other rooms' files can never be reached;
   * - a file still attached to another, non-deleted message is kept, so
   *   pasting someone else's file URL into your own message and deleting it
   *   cannot remove their file.
   * Failures are logged, never thrown: the message is already deleted.
   */
  private async deleteFiles(messageId: string, roomId: string, urls: string[]) {
    if (!this.storage || urls.length === 0) return;
    try {
      const prefix = `channels/${roomId}/`;
      const candidates = [...new Set(urls)]
        .map((url) => ({ url, key: this.storage!.keyFromPublicUrl(url) }))
        .filter((c): c is { url: string; key: string } => !!c.key && c.key.startsWith(prefix));
      if (candidates.length === 0) return;

      const inUse = new Set(
        await this.messageRepository.getAttachmentUrlsInUse(candidates.map((c) => c.url), messageId),
      );
      const results = await Promise.allSettled(
        candidates.filter((c) => !inUse.has(c.url)).map((c) => this.storage!.deleteFile(c.key)),
      );
      results.forEach((r) => {
        if (r.status === "rejected") console.error("[delete-message] storage cleanup failed:", r.reason);
      });
    } catch (err) {
      console.error("[delete-message] storage cleanup failed:", err);
    }
  }

  async execute(userId: string, messageId: string): Promise<void> {
    const message = await this.messageRepository.getMessageById(messageId);

    if (!message) {
      throw new Error("Pesan tidak ditemukan");
    }

    if (message.userId !== userId) {
      throw new Error("Anda tidak memiliki izin untuk menghapus pesan ini");
    }

    await this.roomRepository.fallbackLastReadMessageId(message.roomId, messageId, message.createdAt);

    await this.messageRepository.deleteMessage(messageId);

    // Notify room channel for real-time removal in ChatRoom
    await this.pusherService.trigger(roomChannel(message.roomId), "message-deleted", {
      messageId,
      roomId: message.roomId,
    });

    await this.deleteFiles(
      messageId,
      message.roomId,
      (message.attachments ?? []).map((a) => a.url).filter(Boolean),
    );

    // Notify all participants to refresh their sidebar
    const participants = await this.roomRepository.getOtherParticipants(
      message.roomId,
      userId
    );
    const receiverIds = participants.map((p) => p.userId);

    await this.pusherService.triggerToUsers(
      receiverIds,
      "message-deleted-notification",
      {
        messageId,
        roomId: message.roomId,
      }
    );
  }
}
