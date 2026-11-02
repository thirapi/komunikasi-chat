import { pgTable, text, timestamp, boolean, unique, integer, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("User", {
    id: text("id").primaryKey(),
    username: text("username").unique().notNull(),
    name: text("name"),
    password: text("password").notNull(),
    avatar: text("avatar").default("/avatars/avatar1.png").notNull(),
    bio: text("bio"),
    banner: text("banner"),
    customStatus: text("customStatus"),
    /** Last activity, written from presence heartbeats (throttled) and on going offline. */
    lastSeenAt: timestamp("lastSeenAt"),
    /** Privacy (both reciprocal, like WhatsApp): show exact last seen / send read receipts. */
    showLastSeen: boolean("showLastSeen").default(true).notNull(),
    readReceipts: boolean("readReceipts").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const usersRelations = relations(users, ({ many }) => ({
    userRoles: many(userRoles),
    messages: many(messages),
    forwardedMessages: many(messages, { relationName: "forwardedFrom" }),
    roomParticipants: many(roomParticipants),
    sessions: many(sessions),
    reactions: many(messageReactions),
    pushSubscriptions: many(pushSubscriptions),
}));

export const pushSubscriptions = pgTable("PushSubscription", {
    id: text("id").primaryKey(),
    userId: text("userId").references(() => users.id),
    // "web"   -> VAPID endpoint, with p256dh/auth keys
    // "fcm"   -> a bare Firebase Cloud Messaging device token, no keys
    // Both share `endpoint`; `type` decides which transport sends it.
    type: text("type").default("web").notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh"),
    auth: text("auth"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()),
});

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
    user: one(users, { fields: [pushSubscriptions.userId], references: [users.id] }),
}));

export const messages = pgTable("Message", {
    id: text("id").primaryKey(),
    content: text("content").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
    userId: text("userId").notNull(),
    roomId: text("roomId").notNull(),
    replyTo: text("replyTo"),
    isDeleted: boolean("isDeleted").default(false).notNull(),
    /** Pinned to the top of its room (at most a handful per room). */
    pinnedAt: timestamp("pinnedAt"),
    pinnedBy: text("pinnedBy"),
    /**
     * When the content was last edited. Separate from updatedAt, which also
     * moves for reactions and pins (delta sync relies on that), so those no
     * longer show a message as "(diedit)".
     */
    editedAt: timestamp("editedAt"),
    /** Forwarded from another chat (shown as "Diteruskan"; the source is not kept). */
    isForwarded: boolean("isForwarded").default(false).notNull(),
    /** Who wrote the original of a forwarded message (kept across re-forwards). */
    forwardedFromUserId: text("forwardedFromUserId"),
}, (t) => [
    // Every per-room read is "messages of room X by time": the newest page,
    // paging back, the sidebar's latest message / unread count, and delta
    // sync (createdAt or updatedAt after a cursor).
    index("Message_roomId_createdAt_idx").on(t.roomId, t.createdAt),
    index("Message_roomId_updatedAt_idx").on(t.roomId, t.updatedAt),
]);

/**
 * Cached link previews, shared by everyone (keyed by the normalised URL).
 * status "ok" carries the fields; "none" means the page had nothing to show.
 */
export const linkPreviews = pgTable("LinkPreview", {
    url: text("url").primaryKey(),
    status: text("status").notNull(),
    title: text("title"),
    description: text("description"),
    image: text("image"),
    siteName: text("siteName"),
    fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
});

/** A user blocking another: their DM is closed both ways (channels unaffected). */
export const userBlocks = pgTable("UserBlock", {
    id: text("id").primaryKey(),
    blockerId: text("blockerId").notNull().references(() => users.id),
    blockedId: text("blockedId").notNull().references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
    unique("UserBlock_pair_unq").on(t.blockerId, t.blockedId),
    index("UserBlock_blockedId_idx").on(t.blockedId),
]);

/** Messages a user saved for later (WhatsApp's starred / Teams' saved messages). */
export const savedMessages = pgTable("SavedMessage", {
    id: text("id").primaryKey(),
    userId: text("userId").notNull().references(() => users.id),
    messageId: text("messageId").notNull().references(() => messages.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
    unique("SavedMessage_user_message_unq").on(t.userId, t.messageId),
]);

/** A poll attached to a message (one per message). */
export const polls = pgTable("Poll", {
    id: text("id").primaryKey(),
    messageId: text("messageId").notNull().unique().references(() => messages.id),
    question: text("question").notNull(),
    allowMultiple: boolean("allowMultiple").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const pollOptions = pgTable("PollOption", {
    id: text("id").primaryKey(),
    pollId: text("pollId").notNull().references(() => polls.id),
    text: text("text").notNull(),
    position: integer("position").notNull(),
}, (t) => [index("PollOption_pollId_idx").on(t.pollId)]);

export const pollVotes = pgTable("PollVote", {
    id: text("id").primaryKey(),
    pollId: text("pollId").notNull().references(() => polls.id),
    optionId: text("optionId").notNull().references(() => pollOptions.id),
    userId: text("userId").notNull().references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
    unique("PollVote_option_user_unq").on(t.optionId, t.userId),
    index("PollVote_poll_user_idx").on(t.pollId, t.userId),
]);

export const pollsRelations = relations(polls, ({ one, many }) => ({
    message: one(messages, { fields: [polls.messageId], references: [messages.id] }),
    options: many(pollOptions),
}));

export const pollOptionsRelations = relations(pollOptions, ({ one, many }) => ({
    poll: one(polls, { fields: [pollOptions.pollId], references: [polls.id] }),
    votes: many(pollVotes),
}));

export const pollVotesRelations = relations(pollVotes, ({ one }) => ({
    option: one(pollOptions, { fields: [pollVotes.optionId], references: [pollOptions.id] }),
    user: one(users, { fields: [pollVotes.userId], references: [users.id] }),
}));

/** "Delete for me": a message one user no longer sees. */
export const hiddenMessages = pgTable("HiddenMessage", {
    id: text("id").primaryKey(),
    userId: text("userId").notNull().references(() => users.id),
    messageId: text("messageId").notNull().references(() => messages.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
    unique("HiddenMessage_user_message_unq").on(t.userId, t.messageId),
]);

export const messagesRelations = relations(messages, ({ one, many }) => ({
    user: one(users, { fields: [messages.userId], references: [users.id] }),
    room: one(rooms, { fields: [messages.roomId], references: [rooms.id] }),
    replyToMessage: one(messages, {
        fields: [messages.replyTo],
        references: [messages.id],
        relationName: "replies",
    }),
    replies: many(messages, { relationName: "replies" }),
    attachments: many(attachments),
    reactions: many(messageReactions),
    poll: one(polls, { fields: [messages.id], references: [polls.messageId] }),
    forwardedFrom: one(users, {
        fields: [messages.forwardedFromUserId],
        references: [users.id],
        relationName: "forwardedFrom",
    }),
}));

export const rooms = pgTable("Room", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    isDirect: boolean("isDirect").default(false).notNull(),
    description: text("description"),
    avatar: text("avatar").default("/avatars/avatar6.png").notNull(),
    banner: text("banner"),
    isPublic: boolean("isPublic").default(false).notNull(),
    ownerId: text("ownerId").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const roomsRelations = relations(rooms, ({ many }) => ({
    messages: many(messages),
    participants: many(roomParticipants),
}));

export const roomParticipants = pgTable("RoomParticipant", {
    id: text("id").primaryKey(),
    roomId: text("roomId").notNull(),
    userId: text("userId").notNull(),
    lastReadAt: timestamp("lastReadAt"),
    lastReadMessageId: text("lastReadMessageId").references(() => messages.id),
    /** Notifications for this room are muted until then (far future = forever). */
    mutedUntil: timestamp("mutedUntil"),
    /** Hidden in the chat list's archive since then; null = not archived. */
    archivedAt: timestamp("archivedAt"),
    /** Pinned to the top of this user's chat list (at most 5). */
    pinnedAt: timestamp("pinnedAt"),
    /** "Mark as unread": shown as unread until the chat is opened. */
    markedUnread: boolean("markedUnread").default(false).notNull(),
    /** "member" or "admin"; the owner is rooms.ownerId. */
    role: text("role").default("member").notNull(),
    joinedAt: timestamp("joinedAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => ({
    unq: unique().on(t.roomId, t.userId),
}));

export const roomParticipantsRelations = relations(roomParticipants, ({ one }) => ({
    room: one(rooms, { fields: [roomParticipants.roomId], references: [rooms.id] }),
    user: one(users, { fields: [roomParticipants.userId], references: [users.id] }),
}));

export const sessions = pgTable("Session", {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const sessionsRelations = relations(sessions, ({ one }) => ({
    user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const roles = pgTable("Role", {
    id: text("id").primaryKey(),
    name: text("name").unique().notNull(),
    description: text("description"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const rolesRelations = relations(roles, ({ many }) => ({
    userRoles: many(userRoles),
    permissions: many(rolePermissions),
}));

export const permissions = pgTable("Permission", {
    id: text("id").primaryKey(),
    name: text("name").unique().notNull(),
    description: text("description"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const permissionsRelations = relations(permissions, ({ many }) => ({
    roles: many(rolePermissions),
}));

export const userRoles = pgTable("UserRole", {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    roleId: text("roleId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => ({
    unq: unique().on(t.userId, t.roleId),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
    user: one(users, { fields: [userRoles.userId], references: [users.id] }),
    role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
}));

export const rolePermissions = pgTable("RolePermission", {
    id: text("id").primaryKey(),
    roleId: text("roleId").notNull(),
    permissionId: text("permissionId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => ({
    unq: unique().on(t.roleId, t.permissionId),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
    role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
    permission: one(permissions, { fields: [rolePermissions.permissionId], references: [permissions.id] }),
}));

export const attachments = pgTable("Attachment", {
    id: text("id").primaryKey(),
    url: text("url").notNull(),
    key: text("key").notNull(),
    fileType: text("fileType").notNull(),
    size: integer("size"),
    description: text("description"),
    blurhash: text("blurhash"),
    messageId: text("messageId").references(() => messages.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const attachmentsRelations = relations(attachments, ({ one }) => ({
    message: one(messages, { fields: [attachments.messageId], references: [messages.id] }),
}));

export const messageReactions = pgTable("MessageReaction", {
    id: text("id").primaryKey(),
    messageId: text("messageId").notNull().references(() => messages.id),
    userId: text("userId").references(() => users.id),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => ({
    unq: unique().on(t.messageId, t.userId, t.emoji),
}));

export const messageReactionsRelations = relations(messageReactions, ({ one }) => ({
    message: one(messages, { fields: [messageReactions.messageId], references: [messages.id] }),
    user: one(users, { fields: [messageReactions.userId], references: [users.id] }),
}));

export const customEmojis = pgTable("CustomEmoji", {
    id: text("id").primaryKey(),
    shortcode: text("shortcode").notNull().unique(),
    url: text("url").notNull(),
    category: text("category").default("custom").notNull(),
    isStatic: boolean("isStatic").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const activityLogs = pgTable("ActivityLog", {
    id: text("id").primaryKey(),
    userId: text("userId").references(() => users.id),
    category: text("category").notNull(),
    action: text("action").notNull(),
    metadata: jsonb("metadata"),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
    user: one(users, { fields: [activityLogs.userId], references: [users.id] }),
}));
