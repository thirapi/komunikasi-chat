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
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const usersRelations = relations(users, ({ many }) => ({
    userRoles: many(userRoles),
    messages: many(messages),
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
