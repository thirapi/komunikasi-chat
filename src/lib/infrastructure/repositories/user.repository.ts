import { db } from "@/lib/db";
import { users, userRoles, roomParticipants, sessions, pushSubscriptions, messageReactions, activityLogs, messages, attachments, rooms, userBlocks, savedMessages, polls, pollOptions, pollVotes, hiddenMessages } from "@/lib/infrastructure/drizzle/schema";
import { eq, and, sql, like, inArray, or } from "drizzle-orm";
import { IUserRepository } from "@/lib/application/repositories/user.repository.interface";
import { UserRecord } from "@/lib/entities/models/user.model";
import { createId } from "@paralleldrive/cuid2";

export class UserRepository implements IUserRepository {
  constructor(private client: typeof db) { }

  async delete(userId: string): Promise<void> {
    await this.client.transaction(async (tx) => {
      const userMessages = await tx.select({ id: messages.id }).from(messages).where(eq(messages.userId, userId));
      const userMessageIds = userMessages.map(m => m.id);

      if (userMessageIds.length > 0) {
        await tx.update(messages).set({ replyTo: null }).where(inArray(messages.replyTo, userMessageIds));
        await tx.update(roomParticipants).set({ lastReadMessageId: null }).where(inArray(roomParticipants.lastReadMessageId, userMessageIds));

        await tx.delete(messageReactions).where(inArray(messageReactions.messageId, userMessageIds));
        await tx.delete(savedMessages).where(inArray(savedMessages.messageId, userMessageIds));
        await tx.delete(hiddenMessages).where(inArray(hiddenMessages.messageId, userMessageIds));
        // Polls on the user's messages, with their options and everyone's votes.
        const userPolls = await tx.select({ id: polls.id }).from(polls).where(inArray(polls.messageId, userMessageIds));
        const pollIds = userPolls.map((p) => p.id);
        if (pollIds.length > 0) {
          await tx.delete(pollVotes).where(inArray(pollVotes.pollId, pollIds));
          await tx.delete(pollOptions).where(inArray(pollOptions.pollId, pollIds));
          await tx.delete(polls).where(inArray(polls.id, pollIds));
        }
        await tx.delete(attachments).where(inArray(attachments.messageId, userMessageIds));
        await tx.delete(messages).where(inArray(messages.id, userMessageIds));
      }

      await tx.delete(userRoles).where(eq(userRoles.userId, userId));
      await tx.delete(sessions).where(eq(sessions.userId, userId));
      await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
      await tx.delete(roomParticipants).where(eq(roomParticipants.userId, userId));
      await tx.delete(messageReactions).where(eq(messageReactions.userId, userId));
      await tx.delete(activityLogs).where(eq(activityLogs.userId, userId));
      await tx.delete(savedMessages).where(eq(savedMessages.userId, userId));
      await tx.delete(hiddenMessages).where(eq(hiddenMessages.userId, userId));
      await tx.delete(pollVotes).where(eq(pollVotes.userId, userId));
      // Blocks in either direction reference the user (foreign keys).
      await tx.delete(userBlocks).where(or(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, userId)));

      await tx.update(rooms).set({ ownerId: null }).where(eq(rooms.ownerId, userId));
      await tx.delete(users).where(eq(users.id, userId));
    });
  }

  async findByUsernameWithRoles(username: string): Promise<{
    id: string;
    username: string;
    name?: string | null;
    avatar: string;
    bio?: string | null;
    banner?: string | null;
    customStatus?: string | null;
    roles: { id: string; name: string }[];
    createdAt: Date;
  } | null> {
    const user = await this.client.query.users.findFirst({
      where: eq(users.username, username),
      // `password` (bcrypt hash) is never read on this path — exclude it so the
      // hash is not transferred off Postgres on every authenticated request.
      columns: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        bio: true,
        banner: true,
        customStatus: true,
        createdAt: true,
      },
      with: {
        userRoles: {
          with: {
            role: true,
          },
        },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      avatar: user.avatar,
      bio: user.bio,
      banner: user.banner,
      customStatus: user.customStatus,
      roles: user.userRoles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
      })),
      createdAt: user.createdAt,
    };
  }

  async findByIdWithRoles(id: string): Promise<{
    id: string;
    username: string;
    name?: string | null;
    password: string;
    avatar: string;
    bio?: string | null;
    banner?: string | null;
    customStatus?: string | null;
    roles: { id: string; name: string }[];
  } | null> {
    const user = await this.client.query.users.findFirst({
      where: eq(users.id, id),
      with: {
        userRoles: {
          with: {
            role: true,
          },
        },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      password: user.password,
      avatar: user.avatar,
      bio: user.bio,
      banner: user.banner,
      customStatus: user.customStatus,
      roles: user.userRoles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
      })),
    };
  }

  async updateUserRoles(userId: string, roleIds: string[]) {
    await this.client.transaction(async (tx) => {
      await tx.delete(userRoles).where(eq(userRoles.userId, userId));

      if (roleIds.length === 0) return;

      const data = roleIds.map((roleId) => ({
        id: createId(),
        userId,
        roleId,
      }));
      await tx.insert(userRoles).values(data);
    });
  }

  async insert(user: UserRecord, tx?: any): Promise<void> {
    const client = tx ?? this.client;

    await client.transaction(async (innerTx: any) => {
      await innerTx.insert(users).values(user);

      await innerTx.insert(roomParticipants).values({
        id: createId(),
        roomId: "general-channel",
        userId: user.id,
        lastReadAt: new Date(),
      });
    });
  }

  async findById(id: string): Promise<UserRecord | null> {
    const user = await this.client.query.users.findFirst({
      where: eq(users.id, id),
    });
    return user as UserRecord | null;
  }

  async findByUsername(username: string): Promise<UserRecord | null> {
    const user = await this.client.query.users.findFirst({
      where: eq(users.username, username),
    });
    return user as UserRecord | null;
  }

  async getAllUsersWithRoles(): Promise<
    { id: string; username: string; name?: string | null; avatar: string; roles: { id: string; name: string }[] }[]
  > {
    const allUsers = await this.client.query.users.findMany({
      columns: {
        id: true,
        username: true,
        name: true,
        avatar: true,
      },
      with: {
        userRoles: {
          with: {
            role: true,
          },
        },
      },
    });

    return allUsers.map((user) => ({
      id: user.id,
      username: user.username,
      name: user.name,
      avatar: user.avatar,
      roles: user.userRoles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
      })),
    }));
  }

  async update(
    userId: string,
    user: Partial<UserRecord>,
    tx?: any
  ): Promise<void> {
    const client = tx ?? this.client;
    await client.update(users).set(user).where(eq(users.id, userId));
  }

  async searchUsers(query: string, limit?: number): Promise<{ id: string; username: string; name?: string | null; avatar: string }[]> {
    const results = await this.client.query.users.findMany({
      where: like(users.username, `%${query}%`),
      limit: limit ?? 10,
      columns: {
        id: true,
        username: true,
        name: true,
        avatar: true,
      }
    });
    return results.map(user => ({
      ...user,
      avatar: user.avatar
    }));
  }
}
