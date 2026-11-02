import { db } from "@/lib/db";
import { messages, attachments as attachmentsTable, roomParticipants } from "@/lib/infrastructure/drizzle/schema";
import { eq, ne, asc, desc, lt, gt, and, ilike, or, like, inArray, isNotNull } from "drizzle-orm";
import { IMessageRepository } from "@/lib/application/repositories/message.repository.interface";
import {
  MessageWithUserDTO,
  PinnedMessageDTO,
} from "@/lib/entities/models/message.model";
import { AttachmentWithMessageDTO } from "@/lib/entities/models/attachment.model";
import { createId } from "@paralleldrive/cuid2";

export class MessageRepository implements IMessageRepository {
  constructor(private client: typeof db) { }

  async createMessage(
    userId: string,
    content: string,
    roomId: string,
    replyTo?: string,
    attachments?: { url: string; key: string; fileType: string; size?: number }[],
    options?: { isForwarded?: boolean }
  ): Promise<MessageWithUserDTO> {
    const id = createId();

    return await this.client.transaction(async (tx) => {
      await tx.insert(messages).values({
        id,
        userId,
        content,
        roomId,
        replyTo,
        isForwarded: options?.isForwarded ?? false,
      });

      if (attachments && attachments.length > 0) {
        await tx.insert(attachmentsTable).values(
          attachments.map((a) => ({
            id: createId(),
            messageId: id,
            url: a.url,
            key: a.key,
            fileType: a.fileType,
            size: a.size,
          }))
        );
      }

      const newMessage = await tx.query.messages.findFirst({
        where: eq(messages.id, id),
        with: {
          user: {
            columns: {
              username: true,
              name: true,
              avatar: true,
              bio: true,
              banner: true,
              customStatus: true,
            },
          },
          replyToMessage: {
            with: {
              user: {
                columns: {
                  username: true,
                  name: true,
                },
              },
            },
          },
          attachments: true,
          reactions: {
            with: {
              user: {
                columns: {
                  username: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      return newMessage as unknown as MessageWithUserDTO;
    });
  }

  async getRoomChangesSince(
    roomId: string,
    since: Date,
    limit: number,
  ): Promise<{ changed: MessageWithUserDTO[]; deletedIds: string[]; overflow: boolean }> {
    const rows = await this.client.query.messages.findMany({
      where: and(
        eq(messages.roomId, roomId),
        or(gt(messages.createdAt, since), gt(messages.updatedAt, since)),
      ),
      orderBy: [desc(messages.createdAt)],
      limit: limit + 1,
      with: {
        user: { columns: { username: true, name: true, avatar: true } },
        replyToMessage: {
          with: { user: { columns: { username: true, name: true } } },
        },
        attachments: true,
        reactions: {
          with: { user: { columns: { username: true, name: true } } },
        },
      },
    });

    const overflow = rows.length > limit;
    const window = (overflow ? rows.slice(0, limit) : rows).reverse();
    const deletedIds = window.filter((m) => m.isDeleted).map((m) => m.id);
    const changed = window.filter((m) => !m.isDeleted) as unknown as MessageWithUserDTO[];
    return { changed, deletedIds, overflow };
  }

  async getAttachmentUrlsInUse(urls: string[], excludeMessageId: string): Promise<string[]> {
    if (urls.length === 0) return [];
    const rows = await this.client
      .selectDistinct({ url: attachmentsTable.url })
      .from(attachmentsTable)
      .innerJoin(messages, eq(attachmentsTable.messageId, messages.id))
      .where(
        and(
          inArray(attachmentsTable.url, urls),
          ne(attachmentsTable.messageId, excludeMessageId),
          eq(messages.isDeleted, false),
        ),
      );
    return rows.map((r) => r.url);
  }

  async getPinnedMessages(roomId: string, limit: number): Promise<PinnedMessageDTO[]> {
    const rows = await this.client.query.messages.findMany({
      where: and(eq(messages.roomId, roomId), isNotNull(messages.pinnedAt), eq(messages.isDeleted, false)),
      orderBy: [desc(messages.pinnedAt)],
      limit,
      columns: { id: true, content: true, userId: true, createdAt: true, pinnedAt: true },
      with: {
        user: { columns: { username: true, name: true } },
        attachments: { columns: { fileType: true }, limit: 1 },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      // The banner shows one line; no need to ship long messages around.
      content: r.content.length > 300 ? `${r.content.slice(0, 300)}…` : r.content,
      userId: r.userId,
      user: { username: r.user?.username ?? "", name: r.user?.name ?? null },
      createdAt: r.createdAt,
      pinnedAt: r.pinnedAt as Date,
      attachmentType: r.attachments?.[0]?.fileType ?? null,
    }));
  }

  async setPinned(messageId: string, pinnedBy: string | null): Promise<void> {
    await this.client
      .update(messages)
      .set({ pinnedAt: pinnedBy ? new Date() : null, pinnedBy, updatedAt: new Date() })
      .where(eq(messages.id, messageId));
  }

  async touchMessage(messageId: string): Promise<void> {
    await this.client.update(messages).set({ updatedAt: new Date() }).where(eq(messages.id, messageId));
  }

  async getMessagesByRoomId(roomId: string, limit?: number, before?: Date, after?: Date): Promise<MessageWithUserDTO[]> {
    const filters = [eq(messages.roomId, roomId), eq(messages.isDeleted, false)];
    if (before) {
      filters.push(lt(messages.createdAt, before));
    }
    if (after) {
      filters.push(gt(messages.createdAt, after));
    }

    const allMessages = await this.client.query.messages.findMany({
      where: and(...filters),
      orderBy: [limit ? desc(messages.createdAt) : asc(messages.createdAt)],
      limit: limit,
      with: {
        user: {
          columns: {
            username: true,
            name: true,
            avatar: true,
          },
        },
        replyToMessage: {
          with: {
            user: {
              columns: {
                username: true,
                name: true,
              },
            },
          },
        },
        attachments: true,
        reactions: {
          with: {
            user: {
              columns: {
                username: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const result = allMessages as unknown as MessageWithUserDTO[];

    // If we limit (getting latest), we should sort them back to ascending for the UI
    if (limit) {
      return result.reverse();
    }

    return result;
  }

  async getMessageById(messageId: string): Promise<MessageWithUserDTO | null> {
    const message = await this.client.query.messages.findFirst({
      where: and(eq(messages.id, messageId), eq(messages.isDeleted, false)),
      with: {
        user: {
          columns: {
            username: true,
            name: true,
            avatar: true,
          },
        },
        replyToMessage: {
          with: {
            user: {
              columns: {
                username: true,
                name: true,
              },
            },
          },
        },
        attachments: true,
        reactions: {
          with: {
            user: {
              columns: {
                username: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return (message as unknown as MessageWithUserDTO) || null;
  }

  async getRoomIdByMessageId(messageId: string): Promise<string | null> {
    // Single-column lookup. Reaction toggles only need the room to pick the
    // Pusher channel, and the full graph above costs 5 relational queries.
    const rows = await this.client
      .select({ roomId: messages.roomId })
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.isDeleted, false)))
      .limit(1);
    return rows[0]?.roomId ?? null;
  }

  async updateMessage(messageId: string, content: string): Promise<MessageWithUserDTO> {
    const updatedMessages = await this.client
      .update(messages)
      .set({
        content,
        editedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(messages.id, messageId))
      .returning();

    if (updatedMessages.length === 0) {
      throw new Error("Message not found or update failed");
    }

    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error("Failed to retrieve updated message");
    }

    return message;
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.client.update(messages).set({ isDeleted: true }).where(eq(messages.id, messageId));
  }

  async getAttachmentsByUserId(userId: string, limit?: number): Promise<AttachmentWithMessageDTO[]> {
    const rows = await this.client
      .select()
      .from(attachmentsTable)
      .innerJoin(messages, eq(attachmentsTable.messageId, messages.id))
      .where(
        and(
          eq(messages.userId, userId),
          // A deleted message's photo must not live on in the media grid.
          eq(messages.isDeleted, false),
          or(
            like(attachmentsTable.fileType, "image/%"),
            like(attachmentsTable.fileType, "video/%"),
          ),
        ),
      )
      .orderBy(desc(attachmentsTable.createdAt))
      .limit(limit ?? 50);

    return rows.map((row) => ({
      ...row.Attachment,
      message: {
        userId: row.Message.userId,
        roomId: row.Message.roomId,
      },
    }));
  }

  async getAttachmentsByRoomId(roomId: string, limit?: number): Promise<AttachmentWithMessageDTO[]> {
    const rows = await this.client
      .select()
      .from(attachmentsTable)
      .innerJoin(messages, eq(attachmentsTable.messageId, messages.id))
      .where(
        and(
          eq(messages.roomId, roomId),
          eq(messages.isDeleted, false),
          or(
            like(attachmentsTable.fileType, "image/%"),
            like(attachmentsTable.fileType, "video/%"),
          ),
        ),
      )
      .orderBy(desc(attachmentsTable.createdAt))
      .limit(limit ?? 50);

    return rows.map((row) => ({
      ...row.Attachment,
      message: {
        userId: row.Message.userId,
        roomId: row.Message.roomId,
      },
    }));
  }

  async searchMessages(query: string, roomId?: string, limit: number = 20, viewerId?: string): Promise<MessageWithUserDTO[]> {
    // Escape LIKE wildcards so "%" or "_" typed by the user match literally.
    const pattern = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const filters = [ilike(messages.content, pattern), eq(messages.isDeleted, false)];
    if (roomId) {
      // The caller has already checked that the viewer may read this room.
      filters.push(eq(messages.roomId, roomId));
    } else {
      // Global search only ever covers rooms the viewer belongs to. Without a
      // viewer there is nothing they are allowed to see: fail closed.
      if (!viewerId) return [];
      filters.push(
        inArray(
          messages.roomId,
          this.client
            .select({ roomId: roomParticipants.roomId })
            .from(roomParticipants)
            .where(eq(roomParticipants.userId, viewerId)),
        ),
      );
    }

    const results = await this.client.query.messages.findMany({
      where: and(...filters),
      orderBy: [desc(messages.createdAt)],
      limit: limit,
      with: {
        user: {
          columns: {
            username: true,
            name: true,
            avatar: true,
          },
        },
        replyToMessage: {
          with: {
            user: {
              columns: {
                username: true,
                name: true,
              },
            },
          },
        },
        attachments: true,
        reactions: {
          with: {
            user: {
              columns: {
                username: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return results as unknown as MessageWithUserDTO[];
  }
}
