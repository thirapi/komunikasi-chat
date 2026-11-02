import { db } from "../../db";
import {
    permissions as permissionsTable,
    roles as rolesTable,
    rolePermissions,
    users as usersTable,
    rooms as roomsTable,
    roomParticipants as roomParticipantsTable,
    userRoles as userRolesTable
} from "./schema";
import { eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { hashSync } from "@node-rs/bcrypt";

async function main() {
    console.log("🌱 Starting seed...");

    // 1. Permissions
    const permissions = [
        { name: "create_message", description: "Create a new message" },
        { name: "delete_message", description: "Delete a message" },
        { name: "view_user", description: "View user information" },
        { name: "manage_roles", description: "Manage roles and permissions" },
    ];

    for (const permission of permissions) {
        const existing = await db.query.permissions.findFirst({
            where: eq(permissionsTable.name, permission.name),
        });

        if (!existing) {
            await db.insert(permissionsTable).values({
                id: createId(),
                ...permission,
            });
        }
    }

    // 2. Roles
    const roles = [
        { name: "super_admin", description: "Super Administrator with all access" },
        { name: "admin", description: "Administrator with full access" },
        { name: "moderator", description: "Moderator with limited access" },
        { name: "user", description: "Regular user" },
    ];

    for (const role of roles) {
        const existing = await db.query.roles.findFirst({
            where: eq(rolesTable.name, role.name),
        });

        if (!existing) {
            await db.insert(rolesTable).values({
                id: createId(),
                ...role,
            });
        }
    }

    const adminRole = await db.query.roles.findFirst({
        where: eq(rolesTable.name, "admin"),
    });

    const superAdminRole = await db.query.roles.findFirst({
        where: eq(rolesTable.name, "super_admin"),
    });

    const allPermissions = await db.query.permissions.findMany();

    for (const targetRole of [adminRole, superAdminRole]) {
        if (targetRole) {
            for (const perm of allPermissions) {
                const existing = await db.query.rolePermissions.findFirst({
                    where: and(
                        eq(rolePermissions.roleId, targetRole.id),
                        eq(rolePermissions.permissionId, perm.id)
                    ),
                });

                if (!existing) {
                    await db.insert(rolePermissions).values({
                        id: createId(),
                        roleId: targetRole.id,
                        permissionId: perm.id,
                    });
                }
            }
        }
    }

    // 3. Default Channel
    const defaultRoomID = "general-channel";
    const existingRoom = await db.query.rooms.findFirst({
        where: eq(roomsTable.id, defaultRoomID),
    });

    if (!existingRoom) {
        await db.insert(roomsTable).values({
            id: defaultRoomID,
            name: "general",
            description: "Channel utama untuk semua anggota",
            isPublic: true,
            isDirect: false,
        });
        console.log(`💬 Created default channel: general`);
    }

    // 4. Dev Users
    const hashedPassword = hashSync("password123", 10);

    const devUsers = [
        {
            id: "cmak9alli0001i5sei9vn5szl",
            username: "dev",
            name: "Dev",
            password: hashedPassword,
            avatar: "https://api.dicebear.com/9.x/glass/svg?seed=dex",
            roles: [adminRole?.id].filter(Boolean) as string[],
        },
        {
            id: "cmak9alli0002i5sei9vn5szl",
            username: "dev2",
            name: "Dev 2",
            password: hashedPassword,
            avatar: "https://api.dicebear.com/9.x/glass/svg?seed=Felix",
            roles: [adminRole?.id].filter(Boolean) as string[],
        }
    ];

    for (const { roles, ...user } of devUsers) {
        let userId = user.id;
        const existingUser = await db.query.users.findFirst({
            where: eq(usersTable.username, user.username),
        });

        if (!existingUser) {
            await db.insert(usersTable).values(user);
            console.log(`👤 Created user: ${user.username}`);
        } else {
            userId = existingUser.id;
            await db.update(usersTable).set({ password: user.password }).where(eq(usersTable.id, userId));
            console.log(`👤 Updated user: ${user.username}`);
        }

        for (const roleId of roles) {
            const hasUserRole = await db.query.userRoles.findFirst({
                where: and(
                    eq(userRolesTable.userId, userId),
                    eq(userRolesTable.roleId, roleId)
                ),
            });
            if (!hasUserRole) {
                await db.insert(userRolesTable).values({
                    id: createId(),
                    userId,
                    roleId,
                });
            }
        }

        // Join general channel
        const inRoom = await db.query.roomParticipants.findFirst({
            where: and(
                eq(roomParticipantsTable.roomId, defaultRoomID),
                eq(roomParticipantsTable.userId, userId)
            ),
        });
        if (!inRoom) {
            await db.insert(roomParticipantsTable).values({
                id: createId(),
                roomId: defaultRoomID,
                userId,
                lastReadAt: new Date(),
            });
        }
    }

    console.log("✅ Seeding selesai.");
    process.exit(0);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
