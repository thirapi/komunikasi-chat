import { IMessageRepository } from "../../repositories/message.repository.interface";
import { IRoomRepository } from "../../repositories/room.repository.interface";
import { IUserRepository } from "../../repositories/user.repository.interface";

/** WhatsApp caps forwarding at 5 chats at a time; Telegram allows more. */
export const MAX_FORWARD_TARGETS = 5;

export class ForwardError extends Error {}

export interface ForwardPayload {
  content: string;
  attachments: { url: string; key: string; fileType: string; size?: number }[];
  targetRoomIds: string[];
}

/**
 * Validates a forward and builds what to send to each target chat. Sending
 * itself goes through SendMessageUseCase (the controller calls it per target),
 * so pushes, mute, blocks and idempotency behave exactly like a normal send.
 *
 * - the user must be a member of the source room and of every target;
 * - attachments come from the stored message, never from the client, and the
 *   same files are referenced (storage cleanup keeps a file while any live
 *   message uses it);
 * - mention tokens become plain "@name" text: forwarding "<@everyone>" or a
 *   mention from another room must not ping people in the target chat.
 */
export class ForwardMessageUseCase {
  constructor(
    private messageRepository: Pick<IMessageRepository, "getMessageById">,
    private roomRepository: Pick<IRoomRepository, "getRoomAccess">,
    private userRepository: Pick<IUserRepository, "findById">,
  ) {}

  async prepare(userId: string, messageId: string, targetRoomIds: string[]): Promise<ForwardPayload> {
    const targets = [...new Set(targetRoomIds.filter(Boolean))];
    if (targets.length === 0) throw new ForwardError("Pilih chat tujuan");
    if (targets.length > MAX_FORWARD_TARGETS) {
      throw new ForwardError(`Maksimal ${MAX_FORWARD_TARGETS} chat sekaligus`);
    }

    const message = await this.messageRepository.getMessageById(messageId);
    if (!message) throw new ForwardError("Pesan tidak ditemukan");

    const source = await this.roomRepository.getRoomAccess(message.roomId, userId);
    if (!source.isMember) throw new ForwardError("Pesan tidak ditemukan");

    for (const roomId of targets) {
      const access = await this.roomRepository.getRoomAccess(roomId, userId);
      if (!access.exists || !access.isMember) throw new ForwardError("Kamu bukan anggota salah satu chat tujuan");
    }

    const ids = [...new Set([...(message.content ?? "").matchAll(/<@([a-zA-Z0-9_-]+)>/g)].map((m) => m[1]))];
    const names = new Map<string, string>();
    for (const id of ids) {
      if (id === "everyone") continue;
      const user = await this.userRepository.findById(id).catch(() => null);
      names.set(id, user?.username ?? "pengguna");
    }
    const content = (message.content ?? "").replace(/<@([a-zA-Z0-9_-]+)>/g, (_, id: string) =>
      id === "everyone" ? "@everyone" : `@${names.get(id) ?? "pengguna"}`,
    );

    const attachments = (message.attachments ?? []).map((a) => ({
      url: a.url,
      key: a.key,
      fileType: a.fileType,
      size: a.size ?? undefined,
    }));
    if (!content.trim() && attachments.length === 0) throw new ForwardError("Pesan ini tidak bisa diteruskan");

    return { content, attachments, targetRoomIds: targets };
  }
}
