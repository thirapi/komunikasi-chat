import { db } from "@/lib/db";
import { rooms, roomParticipants, messages, users, userRoles, roles as rolesTable } from "@/lib/infrastructure/drizzle/schema";
import { eq, and, asc, desc, not, sql, exists, inArray } from "drizzle-orm";import { IRoomRepository } from "@/lib/application/repositories/room.repository.interface";
import { RoomWithParticipantsDTO, SidebarRoomRow } from "@/lib/entities/models/room.model";
import { createId } from "@paralleldrive/cuid2";
import { avatarService } from "@/lib/infrastructure/services/avatar.service";

/**
 * Column subset for a room participant's user row. The relational queries below
 * fan out over every participant of every room, so leaving `password` in the
 * default selection ships a bcrypt hash off Postgres for each of them and then
 * throws it away during DTO mapping. Every `participants -> user` selection in
 * this file uses this subset.
 */
const PARTICIPANT_USER_COLUMNS = {
  id: true,
  username: true,
  name: true,
  avatar: true,
  bio: true,
  banner: true,
  customStatus: true,
  createdAt: true,
  lastSeenAt: true,
  showLastSeen: true,
  readReceipts: true,
} as const;

export class RoomRepository implements IRoomRepository {
  constructor(private client: typeof db) { }

  async getRoomById(roomId: string): Promise<RoomWithParticipantsDTO | null> {
    const room = await this.client.query.rooms.findFirst({
      where: (rooms, { eq }) => eq(rooms.id, roomId),
      with: {
        participants: {
          with: {
            user: {
              columns: PARTICIPANT_USER_COLUMNS,
              with: {
                userRoles: {
                  with: {
                    role: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!room) {
      return null;
    }

    return {
      id: room.id,
      name: room.name,
      isDirect: room.isDirect,
      description: room.description ?? null,
      avatar: room.avatar,
      banner: room.banner,
      isPublic: room.isPublic,
      ownerId: room.ownerId,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      participants: room.participants.map((p) => ({
        lastReadMessageId: p.lastReadMessageId,
        lastReadAt: p.lastReadAt,
        user: {
          id: p.user.id,
          username: p.user.username,
          name: p.user.name,
          avatar: p.user.avatar,
          bio: p.user.bio,
          banner: p.user.banner,
          customStatus: p.user.customStatus,
          createdAt: p.user.createdAt,
          lastSeenAt: p.user.lastSeenAt,
          showLastSeen: p.user.showLastSeen,
          readReceipts: p.user.readReceipts,
          userRoles: p.user.userRoles.map((ur) => ({
            role: { name: ur.role.name },
          })),
        },
      })),
      messages: [],
    } as RoomWithParticipantsDTO;
  }

  /**
   * Everything the sidebar renders, for every room the user belongs to, in a
   * single round-trip.
   *
   * The generic `getAllRoomsByUserId` fans out over rooms -> participants ->
   * users -> userRoles -> roles plus a latest-message + attachments query, i.e.
   * 7 round-trips, and materialises every member's full profile (bio, banner,
   * customStatus, createdAt) and role list. The sidebar uses 9 fields and
   * discards the rest.
   *
   * `hasMention` is evaluated with EXISTS over the *unread* range rather than
   * over the single latest message, which is what the previous
   * `messages: { limit: 1 }` relation actually reduced the old check to.
   */
  async getSidebarRooms(userId: string): Promise<SidebarRoomRow[]> {
    const result = await this.client.execute(sql`
      SELECT
        r."id"                          AS "roomId",
        r."name"                        AS "roomName",
        r."avatar"                      AS "roomAvatar",
        r."isDirect"                    AS "isDirect",
        me."lastReadAt"                 AS "lastReadAt",
        me."mutedUntil"                 AS "mutedUntil",
        lm."id"                         AS "lastMessageId",
        lm."content"                    AS "lastMessageContent",
        lm."userId"                     AS "lastMessageUserId",
        lm."createdAt"                  AS "lastMessageCreatedAt",
        att."url"                       AS "lastMessageAttachmentUrl",
        att."fileType"                  AS "lastMessageAttachmentType",
        other."userId"                  AS "otherUserId",
        other_user."username"           AS "otherUsername",
        other_user."avatar"             AS "otherAvatar",
        EXISTS (
          SELECT 1
          FROM "Message" um
          WHERE um."roomId" = r."id"
            AND um."isDeleted" = false
            AND um."userId" <> ${userId}
            -- Message.createdAt has microsecond precision (DB now()) but
            -- lastReadAt is written from a JS Date (milliseconds), so compare
            -- at millisecond precision or the last read message itself always
            -- counts as newer than the read position.
            AND date_trunc('milliseconds', um."createdAt") > COALESCE(me."lastReadAt", to_timestamp(0))
            AND (um."content" LIKE '%<@' || ${userId} || '>%'
                 OR um."content" LIKE '%<@everyone>%')
            -- Only inside a genuinely unread room: the sidebar marks a room read
            -- as soon as its own latest message comes back, so a mention badge
            -- must not survive that. The lm alias is the same latest message
            -- hasUnread is derived from, which keeps the two flags consistent.
            AND lm."id" IS NOT NULL
            AND lm."userId" <> ${userId}
            AND date_trunc('milliseconds', lm."createdAt") > COALESCE(me."lastReadAt", to_timestamp(0))
        ) AS "hasMention",
        -- Unread messages from others, capped: the badge shows "99+" past
        -- that, so counting further would only cost time.
        (
          SELECT COUNT(*)::int FROM (
            SELECT 1
            FROM "Message" uc
            WHERE uc."roomId" = r."id"
              AND uc."isDeleted" = false
              AND uc."userId" <> ${userId}
              AND date_trunc('milliseconds', uc."createdAt") > COALESCE(me."lastReadAt", to_timestamp(0))
            LIMIT 100
          ) unread
        ) AS "unreadCount"
      FROM "Room" r
      JOIN "RoomParticipant" me
        ON me."roomId" = r."id" AND me."userId" = ${userId}
      LEFT JOIN LATERAL (
        SELECT m."id", m."content", m."userId", m."createdAt"
        FROM "Message" m
        WHERE m."roomId" = r."id" AND m."isDeleted" = false
        ORDER BY m."createdAt" DESC
        LIMIT 1
      ) lm ON TRUE
      LEFT JOIN LATERAL (
        SELECT a."url", a."fileType"
        FROM "Attachment" a
        WHERE a."messageId" = lm."id"
        ORDER BY a."createdAt" ASC
        LIMIT 1
      ) att ON lm."id" IS NOT NULL
      LEFT JOIN LATERAL (
        SELECT p."userId"
        FROM "RoomParticipant" p
        WHERE p."roomId" = r."id" AND p."userId" <> ${userId}
        LIMIT 1
      ) other ON r."isDirect" = true
      LEFT JOIN "User" other_user ON other_user."id" = other."userId"
      ORDER BY r."name" ASC
    `);

    // The neon serverless driver (used in production) resolves execute() to a
    // plain row array, while node-postgres resolves to a QueryResult wrapper.
    // Normalise both so the repository is not tied to one transport.
    const rows = Array.isArray(result)
      ? result
      : ((result as { rows?: unknown[] } | null)?.rows ?? []);

    return rows as SidebarRoomRow[];
  }

  async getAllRoomsByUserId(
    userId: string,
    options?: { isDirect?: boolean }
  ): Promise<RoomWithParticipantsDTO[]> {
    const participantRooms = await this.client
      .select({ roomId: roomParticipants.roomId })
      .from(roomParticipants)
      .where(eq(roomParticipants.userId, userId));


    const roomIds = participantRooms.map(p => p.roomId);

    if (roomIds.length === 0) {
      return [];
    }

    const conditions = [inArray(rooms.id, roomIds)];
    if (typeof options?.isDirect === "boolean") {
      conditions.push(eq(rooms.isDirect, options.isDirect));
    }

    const allRooms = await this.client.query.rooms.findMany({
      where: and(...conditions),
      orderBy: [asc(rooms.name)],
      with: {
        participants: {
          with: {
            user: {
              columns: PARTICIPANT_USER_COLUMNS,
              with: {
                userRoles: {
                  with: {
                    role: true,
                  },
                },
              },
            },
          },
        },
        messages: {
          where: eq(messages.isDeleted, false),
          limit: 1,
          orderBy: [desc(messages.createdAt)],
          columns: {
            id: true,
            content: true,
            userId: true,
            createdAt: true,
            updatedAt: true,
            isDeleted: true,
          },
          with: {
            attachments: true,
          },
        },
      },
    });

    const dtoRooms = allRooms.map((room) => ({
      id: room.id,
      name: room.name,
      isDirect: room.isDirect,
      description: room.description ?? null,
      avatar: room.avatar,
      banner: room.banner,
      isPublic: room.isPublic,
      ownerId: room.ownerId,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      participants: room.participants.map((p) => ({
        lastReadMessageId: p.lastReadMessageId,
        lastReadAt: p.lastReadAt,
        user: {
          id: p.user.id,
          username: p.user.username,
          name: p.user.name,
          avatar: p.user.avatar,
          bio: p.user.bio,
          banner: p.user.banner,
          customStatus: p.user.customStatus,
          createdAt: p.user.createdAt,
          userRoles: p.user.userRoles.map((ur) => ({
            role: { name: ur.role.name },
          })),
        },
      })),
      messages: room.messages as any[],
    } as RoomWithParticipantsDTO));

    return dtoRooms.sort((a, b) => {
      const aTime = a.messages[0]?.createdAt
        ? new Date(a.messages[0].createdAt).getTime()
        : 0;
      const bTime = b.messages[0]?.createdAt
        ? new Date(b.messages[0].createdAt).getTime()
        : 0;
      return bTime - aTime;
    });
  }

  async updateLastReadAt(
    userId: string,
    roomId: string,
    messageId: string,
    lastReadAt?: Date
  ): Promise<void> {
    await this.client
      .update(roomParticipants)
      .set({
        lastReadMessageId: messageId,
        lastReadAt: lastReadAt ?? new Date()
      })
      .where(
        and(
          eq(roomParticipants.roomId, roomId),
          eq(roomParticipants.userId, userId)
        )
      );
  }

  async getLastReadAt(userId: string, roomId: string): Promise<{ id: string | null; at: Date | null }> {
    const participant = await this.client.query.roomParticipants.findFirst({
      where: and(
        eq(roomParticipants.roomId, roomId),
        eq(roomParticipants.userId, userId)
      ),
      columns: {
        lastReadMessageId: true,
        lastReadAt: true,
      },
    });

    return {
      id: participant?.lastReadMessageId ?? null,
      at: participant?.lastReadAt ?? null,
    };
  }

  async findDirectRoomBetweenUsers(userId1: string, userId2: string): Promise<{ id: string } | null> {
    const rooms1 = await this.client
      .select({ roomId: roomParticipants.roomId })
      .from(roomParticipants)
      .where(and(
        eq(roomParticipants.userId, userId1),
        eq(rooms.isDirect, true),
      ))
      .innerJoin(rooms, eq(roomParticipants.roomId, rooms.id));

    const rooms2 = await this.client
      .select({ roomId: roomParticipants.roomId })
      .from(roomParticipants)
      .where(and(
        eq(roomParticipants.userId, userId2),
        eq(rooms.isDirect, true),
      ))
      .innerJoin(rooms, eq(roomParticipants.roomId, rooms.id));

    const intersection = rooms1.find(r1 =>
      rooms2.some(r2 => r2.roomId === r1.roomId)
    );

    return intersection ? { id: intersection.roomId } : null;
  }

  async getOtherParticipants(
    roomId: string,
    excludeUserId: string
  ): Promise<{ userId: string; mutedUntil: Date | null }[]> {
    const others = await this.client.query.roomParticipants.findMany({
      where: and(
        eq(roomParticipants.roomId, roomId),
        not(eq(roomParticipants.userId, excludeUserId))
      ),
      columns: {
        userId: true,
        mutedUntil: true,
      },
    });

    return others;
  }

  async setMutedUntil(userId: string, roomId: string, mutedUntil: Date | null): Promise<void> {
    await this.client
      .update(roomParticipants)
      .set({ mutedUntil })
      .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, userId)));
  }

  /**
   * The facts an authorization check needs about one room for one user, in a
   * single indexed query (no participant fan-out).
   */
  async getRoomAccess(
    roomId: string,
    userId: string,
  ): Promise<{ exists: boolean; isMember: boolean; isPublic: boolean; isDirect: boolean; ownerId: string | null }> {
    const [row] = await this.client
      .select({
        isPublic: rooms.isPublic,
        isDirect: rooms.isDirect,
        ownerId: rooms.ownerId,
        memberId: roomParticipants.id,
      })
      .from(rooms)
      .leftJoin(
        roomParticipants,
        and(eq(roomParticipants.roomId, rooms.id), eq(roomParticipants.userId, userId)),
      )
      .where(eq(rooms.id, roomId))
      .limit(1);

    if (!row) return { exists: false, isMember: false, isPublic: false, isDirect: false, ownerId: null };
    return {
      exists: true,
      isMember: !!row.memberId,
      isPublic: row.isPublic,
      isDirect: row.isDirect,
      ownerId: row.ownerId,
    };
  }

  async getParticipantIds(roomId: string): Promise<string[]> {
    // Only the membership set is needed by the invite search. getRoomById
    // would drag in rooms -> participants -> users -> userRoles -> roles
    // (and the participants' password hashes) for the same information.
    const rows = await this.client
      .select({ userId: roomParticipants.userId })
      .from(roomParticipants)
      .where(eq(roomParticipants.roomId, roomId));

    return rows.map((row) => row.userId);
  }

  async createRoom(
    name: string,
    isDirect: boolean,
    participantIds: string[],
    avatar: string,
    description?: string,
    isPublic: boolean = false,
    ownerId?: string
  ): Promise<RoomWithParticipantsDTO> {
    const roomId = createId();

    return await this.client.transaction(async (tx) => {
      await tx.insert(rooms).values({
        id: roomId,
        name,
        isDirect,
        description,
        avatar,
        isPublic,
        ownerId,
      });

      const participantValues = participantIds.map((userId) => ({
        id: createId(),
        roomId,
        userId,
      }));

      await tx.insert(roomParticipants).values(participantValues);

      const newRoom = await tx.query.rooms.findFirst({
        where: eq(rooms.id, roomId),
        with: {
          participants: {
            with: {
              user: {
                columns: PARTICIPANT_USER_COLUMNS,
                with: {
                  userRoles: {
                    with: {
                      role: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!newRoom) throw new Error("Failed to retrieve newly created room");

      return {
        id: newRoom.id,
        name: newRoom.name,
        isDirect: newRoom.isDirect,
        description: newRoom.description ?? null,
        avatar: newRoom.avatar || avatarService.generateAvatarUrl(newRoom.name),
        banner: newRoom.banner,
        isPublic: newRoom.isPublic,
        ownerId: newRoom.ownerId,
        createdAt: newRoom.createdAt,
        updatedAt: newRoom.updatedAt,
        participants: newRoom.participants.map((p) => ({
          lastReadMessageId: p.lastReadMessageId,
          lastReadAt: p.lastReadAt,
          user: {
            id: p.user.id,
            username: p.user.username,
            avatar: p.user.avatar,
            bio: p.user.bio,
            banner: p.user.banner,
            customStatus: p.user.customStatus,
            createdAt: p.user.createdAt,
            userRoles: p.user.userRoles.map((ur) => ({
              role: { name: ur.role.name },
            })),
          },
        })),
        messages: [],
      } as RoomWithParticipantsDTO;
    });
  }

  async getPublicRooms(excludeUserId: string): Promise<RoomWithParticipantsDTO[]> {
    const joinedRoomIds = await this.client
      .select({ roomId: roomParticipants.roomId })
      .from(roomParticipants)
      .where(eq(roomParticipants.userId, excludeUserId));

    const joinedIds = joinedRoomIds.map(p => p.roomId);

    const publicRooms = await this.client.query.rooms.findMany({
      where: joinedIds.length > 0
        ? and(eq(rooms.isPublic, true), not(inArray(rooms.id, joinedIds)))
        : eq(rooms.isPublic, true),
      with: {
        participants: {
          with: {
            user: {
              columns: PARTICIPANT_USER_COLUMNS,
              with: {
                userRoles: {
                  with: {
                    role: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return publicRooms.map(room => ({
      id: room.id,
      name: room.name,
      isDirect: room.isDirect,
      description: room.description ?? null,
      avatar: room.avatar,
      banner: room.banner,
      isPublic: room.isPublic,
      ownerId: room.ownerId,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      participants: room.participants.map((p) => ({
        lastReadMessageId: p.lastReadMessageId,
        lastReadAt: p.lastReadAt,
        user: {
          id: p.user.id,
          username: p.user.username,
          name: p.user.name,
          avatar: p.user.avatar,
          bio: p.user.bio,
          banner: p.user.banner,
          customStatus: p.user.customStatus,
          createdAt: p.user.createdAt,
          userRoles: p.user.userRoles.map((ur) => ({
            role: { name: ur.role.name },
          })),
        },
      })),
      messages: [],
    } as RoomWithParticipantsDTO));
  }

  async addParticipant(roomId: string, userId: string): Promise<void> {
    await this.client.insert(roomParticipants).values({
      id: createId(),
      roomId,
      userId,
    });
  }

  async removeParticipant(roomId: string, userId: string): Promise<void> {
    await this.client
      .delete(roomParticipants)
      .where(
        and(
          eq(roomParticipants.roomId, roomId),
          eq(roomParticipants.userId, userId)
        )
      );
  }

  async updateRoom(roomId: string, data: { name?: string; description?: string; isPublic?: boolean; avatar?: string; banner?: string }): Promise<void> {
    await this.client
      .update(rooms)
      .set(data)
      .where(eq(rooms.id, roomId));
  }

  async deleteRoom(roomId: string): Promise<void> {
    await this.client.delete(roomParticipants).where(eq(roomParticipants.roomId, roomId));
    await this.client.delete(messages).where(eq(messages.roomId, roomId));
    await this.client.delete(rooms).where(eq(rooms.id, roomId));
  }

  async fallbackLastReadMessageId(
    roomId: string,
    deletedMessageId: string,
    fallbackBeforeDate: Date
  ): Promise<void> {
    const previousMessage = await this.client.query.messages.findFirst({
      where: and(
        eq(messages.roomId, roomId),
        not(eq(messages.id, deletedMessageId)),
        sql`${messages.createdAt} <= ${fallbackBeforeDate.toISOString()}`
      ),
      orderBy: [desc(messages.createdAt)],
    });

    if (previousMessage) {
      await this.client
        .update(roomParticipants)
        .set({
          lastReadMessageId: previousMessage.id,
          lastReadAt: previousMessage.createdAt,
        })
        .where(
          and(
            eq(roomParticipants.roomId, roomId),
            eq(roomParticipants.lastReadMessageId, deletedMessageId)
          )
        );
    } else {
      await this.client
        .update(roomParticipants)
        .set({
          lastReadMessageId: null,
          // We don't overwrite lastReadAt here as part of Timestamp Fallback
          // so that the unread position remains mathematically valid.
        })
        .where(
          and(
            eq(roomParticipants.roomId, roomId),
            eq(roomParticipants.lastReadMessageId, deletedMessageId)
          )
        );
    }
  }
}
