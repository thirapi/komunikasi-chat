"use server";
import {
  AuthorizationError,
  assertCanReadRoom,
  assertRoomMember,
  getRoomAccess,
  requireReader,
  requireWriter,
} from "@/lib/auth/actor";
import { ServerResponse } from "@/lib/entities/models/response.model";
import { RoomWithParticipantsDTO } from "@/lib/entities/models/room.model";
import { createRoomController } from "@/lib/interface-adapters/controllers/rooms/create-room.controller";
import { getRoomByIdController } from "@/lib/interface-adapters/controllers/rooms/get-room-by-id.controller";
import { syncRoomMessagesController } from "@/lib/interface-adapters/controllers/messages/sync-room-messages.controller";
import type { RoomSync } from "@/lib/application/use-cases/messages/sync-room-messages.use-case";
import { getPinnedMessagesController } from "@/lib/interface-adapters/controllers/messages/toggle-pin.controller";
import type { PinnedMessageDTO } from "@/lib/entities/models/message.model";
import type { BlockStatus } from "@/lib/entities/models/block.model";
import { getRoomBlockStatusController } from "@/lib/interface-adapters/controllers/users/block-user.controller";
import { getLastReadAtController } from "@/lib/interface-adapters/controllers/rooms/get-last-read-at.controller";
import {
  setRoomMuteController,
  setRoomArchivedController,
  setChatPinnedController,
  setMarkedUnreadController,
  markRoomReadController,
} from "@/lib/interface-adapters/controllers/rooms/set-room-mute.controller";
import { getRoomByUserIdController } from "@/lib/interface-adapters/controllers/rooms/get-room-by-user-id.controller";
import { getSidebarDataController } from "@/lib/interface-adapters/controllers/rooms/get-sidebar-data.controller";
import { SidebarRoomDTO } from "@/lib/entities/models/room.model";
import { getPublicRoomsController } from "@/lib/interface-adapters/controllers/rooms/get-public-rooms.controller";

export const getSidebarData = async (
  userId: string
): Promise<ServerResponse<{ channels: SidebarRoomDTO[]; directMessages: SidebarRoomDTO[] }>> => {
  try {
    // Always the viewer's own sidebar, whatever id the client sends.
    const data = await getSidebarDataController(await requireReader());

    return {
      status: "success",
      data,
      error: null,
    };
  } catch (err: any) {
    return {
      status: "error",
      data: { channels: [], directMessages: [] },
      error: {
        message: err.message,
        type: err.name,
        meta: err.fields,
      },
    };
  }
};
import { joinRoomController } from "@/lib/interface-adapters/controllers/rooms/join-room.controller";
import { removeParticipantController } from "@/lib/interface-adapters/controllers/rooms/remove-participant.controller";
import { updateRoomController, deleteRoomController, setParticipantRoleController } from "@/lib/interface-adapters/controllers/rooms/room-settings.controller";
import { searchInvitableUsersController, inviteToRoomController } from "@/lib/interface-adapters/controllers/rooms/invite-to-room.controller";
import { revalidatePath } from "next/cache";

export const getRoom = async (
  roomId: string
): Promise<ServerResponse<RoomWithParticipantsDTO | null>> => {
  try {
    const viewerId = await requireReader();
    await assertCanReadRoom(roomId, viewerId);
    const room = await getRoomByIdController(roomId, viewerId);

    return {
      status: "success",
      data: room,
      error: null,
    };
  } catch (err: any) {
    return {
      status: "error",
      data: null,
      error: {
        message: err.message,
        type: err.name,
        meta: err.fields,
      },
    };
  }
};

/**
 * Everything a room needs to open — metadata, its messages and the viewer's
 * read position — in one request.
 *
 * Next.js runs server actions from one client one at a time, so opening a room
 * with getRoom → getMessage → getLastReadAt cost three sequential round trips.
 * One action, with the reads run in parallel on the server.
 *
 * `since` is the cursor from this room's previous sync. With it, only messages
 * created or changed since come back (`sync.mode === "delta"`), to be applied
 * on top of the client cache; without it, or when too much changed, the newest
 * page comes back in full.
 */
export const getRoomSnapshot = async (
  roomId: string,
  since?: Date | string | null
): Promise<
  ServerResponse<{
    room: RoomWithParticipantsDTO;
    lastRead: { id: string | null; at: Date | null };
    sync: RoomSync;
    pins: PinnedMessageDTO[];
    /** DMs only: block relation with the other person. */
    block: BlockStatus | null;
  } | null>
> => {
  try {
    const viewerId = await requireReader();
    await assertCanReadRoom(roomId, viewerId);
    const [room, sync, lastRead, pins] = await Promise.all([
      getRoomByIdController(roomId, viewerId),
      syncRoomMessagesController(roomId, since ? new Date(since) : null, viewerId),
      getLastReadAtController(viewerId, roomId),
      getPinnedMessagesController(roomId),
    ]);
    if (!room) {
      return { status: "error", data: null, error: { message: "Room tidak ditemukan", type: "NotFound" } };
    }
    const block = await getRoomBlockStatusController(viewerId, room);
    return { status: "success", data: { room, lastRead, sync, pins, block }, error: null };
  } catch (err: any) {
    console.error("Action Error:", err);
    return {
      status: "error",
      data: null,
      error: { message: err.message, type: err.name, meta: err.fields },
    };
  }
};

/** Mute (or unmute with "off") a room's notifications for the signed-in user. */
export const setRoomMuteAction = async (
  roomId: string,
  duration: "1h" | "8h" | "1w" | "forever" | "off"
): Promise<ServerResponse<{ mutedUntil: Date | null } | null>> => {
  try {
    const actorId = await requireWriter();
    await assertRoomMember(roomId, actorId);
    const mutedUntil = await setRoomMuteController(actorId, roomId, duration);
    return { status: "success", data: { mutedUntil }, error: null };
  } catch (err: any) {
    console.error("Action Error:", err);
    return { status: "error", data: null, error: { message: err.message, type: err.name } };
  }
};

/** Archive or unarchive a chat for the signed-in user. */
export const setRoomArchivedAction = async (
  roomId: string,
  archived: boolean
): Promise<ServerResponse<{ archivedAt: Date | null } | null>> => {
  try {
    const actorId = await requireWriter();
    await assertRoomMember(roomId, actorId);
    const archivedAt = await setRoomArchivedController(actorId, roomId, archived);
    return { status: "success", data: { archivedAt }, error: null };
  } catch (err: any) {
    console.error("Action Error:", err);
    return { status: "error", data: null, error: { message: err.message, type: err.name } };
  }
};

/** Pin a chat to the top of the chat list (max 5) or unpin it. */
export const setChatPinnedAction = async (roomId: string, pinned: boolean) => {
  try {
    const actorId = await requireWriter();
    await assertRoomMember(roomId, actorId);
    return { status: "success" as const, data: { pinnedAt: await setChatPinnedController(actorId, roomId, pinned) }, error: null };
  } catch (err: any) {
    return { status: "error" as const, data: null, error: { message: err.message, type: err.name } };
  }
};

/** Owner only: make a member an admin, or back to a member. */
export const setParticipantRoleAction = async (roomId: string, userId: string, role: "admin" | "member") => {
  try {
    const actorId = await requireWriter();
    await setParticipantRoleController(actorId, roomId, userId, role);
    return { status: "success" as const, data: null, error: null };
  } catch (err: any) {
    return { status: "error" as const, data: null, error: { message: err.message, type: err.name } };
  }
};

/** Mark a chat as read from the chat list, without opening it. */
export const markRoomReadAction = async (roomId: string) => {
  try {
    const actorId = await requireWriter();
    await assertRoomMember(roomId, actorId);
    await markRoomReadController(actorId, roomId);
    return { status: "success" as const, data: null, error: null };
  } catch (err: any) {
    return { status: "error" as const, data: null, error: { message: err.message, type: err.name } };
  }
};

/** Mark a chat as unread (or clear it). */
export const setMarkedUnreadAction = async (roomId: string, markedUnread: boolean) => {
  try {
    const actorId = await requireWriter();
    await assertRoomMember(roomId, actorId);
    await setMarkedUnreadController(actorId, roomId, markedUnread);
    return { status: "success" as const, data: null, error: null };
  } catch (err: any) {
    return { status: "error" as const, data: null, error: { message: err.message, type: err.name } };
  }
};

export const getRoomsByUserId = async (
  userId: string,
  options?: { isDirect?: boolean }
): Promise<ServerResponse<RoomWithParticipantsDTO[] | null>> => {
  try {
    const rooms = await getRoomByUserIdController(await requireReader(), options);

    return {
      status: "success",
      data: rooms,
      error: null,
    };
  } catch (err: any) {
    return {
      status: "error",
      data: [],
      error: {
        message: err.message,
        type: err.name,
        meta: err.fields,
      },
    };
  }
};

import { startDirectMessageController } from "@/lib/interface-adapters/controllers/rooms/start-direct-message.controller";

export const createRoom = async (
  currentUserId: string,
  targetUserId: string
):  Promise<ServerResponse<RoomWithParticipantsDTO | null> & { meta?: { action: "existing" | "created" } }> => {
  try {
    const actorId = await requireWriter(currentUserId);
    if (targetUserId === actorId) throw new AuthorizationError("Tidak bisa mengirim pesan ke diri sendiri");
    const response = await startDirectMessageController(actorId, targetUserId);

    return {
      status: "success",
      data: response.room,
      error: null,
      meta: { action: response.action },
    };
  } catch (err: any) {
    return {
      status: "error",
      data: null,
      error: {
        message: err.message,
        type: err.name,
        meta: err.fields,
      },
    };
  }
};
export const createChannel = async (
  name: string,
  userId: string,
  description?: string,
  isPublic: boolean = false
): Promise<ServerResponse<RoomWithParticipantsDTO | null>> => {
  try {
    const actorId = await requireWriter(userId);
    const newRoom = await createRoomController({
      name,
      isDirect: false,
      participantIds: [actorId],
      description,
      isPublic,
      ownerId: actorId,
    });

    revalidatePath("/");

    return {
      status: "success",
      data: newRoom,
      error: null,
    };
  } catch (err: any) {
    return {
      status: "error",
      data: null,
      error: {
        message: err.message,
        type: err.name,
        meta: err.fields,
      },
    };
  }
};

export const getPublicRooms = async (
  userId: string
): Promise<ServerResponse<RoomWithParticipantsDTO[]>> => {
  try {
    const rooms = await getPublicRoomsController(await requireReader());

    return {
      status: "success",
      data: rooms,
      error: null,
    };
  } catch (err: any) {
    return {
      status: "error",
      data: [],
      error: {
        message: err.message,
        type: err.name,
        meta: err.fields,
      },
    };
  }
};

export const joinRoom = async (
  roomId: string,
  userId: string
): Promise<ServerResponse<boolean>> => {
  try {
    const actorId = await requireWriter(userId);
    // This endpoint only joins public channels. Private channels are joined
    // through an invite (inviteToChannel) or the invite link page, which
    // performs its own checks server-side.
    const access = await getRoomAccess(roomId, actorId);
    if (!access.exists || access.isDirect || !access.isPublic) {
      throw new AuthorizationError("Channel ini privat. Minta undangan dari pemiliknya.");
    }
    if (!access.isMember) await joinRoomController(roomId, actorId);

    revalidatePath("/");

    return {
      status: "success",
      data: true,
      error: null,
    };
  } catch (err: any) {
    return {
      status: "error",
      data: false,
      error: {
        message: err.message,
        type: err.name,
        meta: err.fields,
      },
    };
  }
};

export const removeParticipant = async (
  roomId: string,
  userId: string,
  requesterId: string
): Promise<ServerResponse<boolean>> => {
  try {
    const actorId = await requireWriter(requesterId);
    await removeParticipantController(roomId, userId, actorId);

    revalidatePath("/");

    return {
      status: "success",
      data: true,
      error: null,
    };
  } catch (err: any) {
    return {
      status: "error",
      data: false,
      error: {
        message: err.message,
        type: err.name,
        meta: err.fields,
      },
    };
  }
};

export const updateChannel = async (
  roomId: string,
  requesterId: string,
  data: { name?: string; description?: string; isPublic?: boolean; avatar?: string; banner?: string }
): Promise<ServerResponse<boolean>> => {
  try {
    const actorId = await requireWriter(requesterId);
    await updateRoomController(roomId, actorId, data);
    revalidatePath("/");
    return { status: "success", data: true, error: null };
  } catch (err: any) {
    return {
      status: "error",
      data: false,
      error: { message: err.message, type: err.name, meta: err.fields },
    };
  }
};

export const deleteChannel = async (
  roomId: string,
  requesterId: string
): Promise<ServerResponse<boolean>> => {
  try {
    const actorId = await requireWriter(requesterId);
    await deleteRoomController(roomId, actorId);
    revalidatePath("/");
    return { status: "success", data: true, error: null };
  } catch (err: any) {
    return {
      status: "error",
      data: false,
      error: { message: err.message, type: err.name, meta: err.fields },
    };
  }
};

export const searchInvitableUsers = async (
  roomId: string,
  query: string
): Promise<ServerResponse<{ id: string; username: string; avatar: string}[]>> => {
  try {
    await assertRoomMember(roomId, await requireReader());
    const users = await searchInvitableUsersController(roomId, query);
    return { status: "success", data: users, error: null };
  } catch (err: any) {
    return {
      status: "error",
      data: [],
      error: { message: err.message, type: err.name, meta: err.fields },
    };
  }
};

export const inviteToChannel = async (
  roomId: string,
  requesterId: string,
  targetUserId: string
): Promise<ServerResponse<boolean>> => {
  try {
    const actorId = await requireWriter(requesterId);
    await assertRoomMember(roomId, actorId);
    await inviteToRoomController(roomId, actorId, targetUserId);
    revalidatePath("/");
    return { status: "success", data: true, error: null };
  } catch (err: any) {
    return {
      status: "error",
      data: false,
      error: { message: err.message, type: err.name, meta: err.fields },
    };
  }
};
