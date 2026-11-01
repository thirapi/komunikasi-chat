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
import { getMessageController } from "@/lib/interface-adapters/controllers/messages/get-message.controller";
import { getLastReadAtController } from "@/lib/interface-adapters/controllers/rooms/get-last-read-at.controller";
import { MessageWithUserDTO } from "@/lib/entities/models/message.model";
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
import { updateRoomController, deleteRoomController } from "@/lib/interface-adapters/controllers/rooms/room-settings.controller";
import { searchInvitableUsersController, inviteToRoomController } from "@/lib/interface-adapters/controllers/rooms/invite-to-room.controller";
import { revalidatePath } from "next/cache";

export const getRoom = async (
  roomId: string
): Promise<ServerResponse<RoomWithParticipantsDTO | null>> => {
  try {
    await assertCanReadRoom(roomId, await requireReader());
    const room = await getRoomByIdController(roomId);

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
 * Everything a room needs to open — metadata, the newest page of messages and
 * the viewer's read position — in one request.
 *
 * Next.js runs server actions from one client one at a time, so opening a room
 * with getRoom → getMessage → getLastReadAt cost three sequential round trips
 * (more if a read-state update was queued in front of them). That gap is what
 * made a room open on its stale cached view and only show new messages a beat
 * later. One action, with the three reads run in parallel on the server.
 */
export const getRoomSnapshot = async (
  roomId: string
): Promise<
  ServerResponse<{
    room: RoomWithParticipantsDTO;
    messages: MessageWithUserDTO[];
    lastRead: { id: string | null; at: Date | null };
  } | null>
> => {
  try {
    const viewerId = await requireReader();
    await assertCanReadRoom(roomId, viewerId);
    const [room, messages, lastRead] = await Promise.all([
      getRoomByIdController(roomId),
      getMessageController(roomId, 50),
      getLastReadAtController(viewerId, roomId),
    ]);
    if (!room) {
      return { status: "error", data: null, error: { message: "Room tidak ditemukan", type: "NotFound" } };
    }
    return { status: "success", data: { room, messages: messages ?? [], lastRead }, error: null };
  } catch (err: any) {
    console.error("Action Error:", err);
    return {
      status: "error",
      data: null,
      error: { message: err.message, type: err.name, meta: err.fields },
    };
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
