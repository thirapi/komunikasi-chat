"use server";

import {
  AuthorizationError,
  assertCanReadRoom,
  assertMessageRoomMember,
  assertRoomMember,
  getActor,
  getMessageRoomId,
  requireReader,
  requireWriter,
} from "@/lib/auth/actor";

/** Storage folders the client may upload into (besides `channels/<roomId>`). */
const UPLOAD_FOLDERS = new Set(["avatars", "banners", "room-avatars", "room-banners"]);
import { ServerResponse } from "@/lib/entities/models/response.model";
import { getMessageController } from "@/lib/interface-adapters/controllers/messages/get-message.controller";
import { syncRoomMessagesController } from "@/lib/interface-adapters/controllers/messages/sync-room-messages.controller";
import { togglePinController } from "@/lib/interface-adapters/controllers/messages/toggle-pin.controller";
import { sendMessageController } from "@/lib/interface-adapters/controllers/messages/send-message.controller";
import {
  startTypingController,
  stopTypingController,
} from "@/lib/interface-adapters/controllers/messages/typing.controller";
import { updateLastReadAtController } from "@/lib/interface-adapters/controllers/rooms/update-last-read-at.controller";
import { getLastReadAtController } from "@/lib/interface-adapters/controllers/rooms/get-last-read-at.controller";
import { uploadFileController, createUploadUrlController } from "@/lib/interface-adapters/controllers/storage/upload-file.controller";
import { MessageWithUserDTO } from "@/lib/entities/models/message.model";
import { revalidatePath } from "next/cache";
import { deleteMessageController } from "@/lib/interface-adapters/controllers/messages/delete-message.controller";
import { editMessageController } from "@/lib/interface-adapters/controllers/messages/edit-message.controller";
import { searchMessagesController } from "@/lib/interface-adapters/controllers/messages/search-messages.controller";
import { toggleReactionController } from "@/lib/interface-adapters/controllers/messages/toggle-reaction.controller";

export const toggleReactionAction = async (
  userId: string,
  messageId: string,
  emoji: string
): Promise<ServerResponse<{ action: "added" | "removed" } | null>> => {
  try {
    const actorId = await requireWriter(userId);
    await assertMessageRoomMember(messageId, actorId);
    const result = await toggleReactionController(actorId, messageId, emoji);
    return {
      status: "success",
      data: { action: result.action },
      error: null,
    };
  } catch (err: any) {
    console.error("Action Error:", err);
    return {
      status: "error",
      data: null,
      error: {
        message: err.message || "Terjadi kesalahan internal",
        type: err.name,
      },
    };
  }
};

export const setTypingStatusAction = async (
  userId: string,
  roomId: string,
  typing: boolean
): Promise<ServerResponse<null>> => {
  try {
    const actorId = await requireWriter(userId);
    await assertRoomMember(roomId, actorId);
    if (typing) {
      await startTypingController(actorId, roomId);
    } else {
      await stopTypingController(actorId, roomId);
    }
    return {
      status: "success",
      data: null,
      error: null,
    };
  } catch (err: any) {
    console.error("Action Error:", err);
    return {
      status: "error",
      data: null,
      error: {
        message: err.message?.includes("Failed query") ? "Gagal memproses permintaan ke database" : err.message || "Terjadi kesalahan internal",
        type: err.name,
        meta: err.fields,
      },
    };
  }
};

export const searchMessagesAction = async (
  query: string,
  roomId?: string,
  limit?: number
): Promise<ServerResponse<MessageWithUserDTO[]>> => {
  try {
    const viewerId = await requireReader();
    if (roomId) await assertCanReadRoom(roomId, viewerId);
    // Global search is limited to the viewer's rooms inside the repository.
    const data = await searchMessagesController(query, roomId, Math.min(limit ?? 20, 50), viewerId);

    return {
      status: "success",
      data,
      error: null,
    };
  } catch (err: any) {
    console.error("Action Error:", err);
    return {
      status: "error",
      data: [],
      error: {
        message: err.message?.includes("Failed query") ? "Gagal memproses permintaan ke database" : err.message || "Terjadi kesalahan internal",
        type: err.name,
        meta: err.fields,
      },
    };
  }
};

export const deleteMessageAction = async (
  userId: string,
  messageId: string
): Promise<ServerResponse<null>> => {
  try {
    const actorId = await requireWriter(userId);
    await deleteMessageController(actorId, messageId);

    return {
      status: "success",
      data: null,
      error: null,
    };
  } catch (err: any) {
    console.error("Action Error:", err);
    return {
      status: "error",
      data: null,
      error: {
        message: err.message?.includes("Failed query") ? "Gagal memproses permintaan ke database" : err.message || "Terjadi kesalahan internal",
        type: err.name,
        meta: err.fields,
      },
    };
  }
};

export const editMessageAction = async (
  userId: string,
  messageId: string,
  content: string
): Promise<ServerResponse<MessageWithUserDTO | null>> => {
  try {
    const actorId = await requireWriter(userId);
    const data = await editMessageController(actorId, messageId, content);

    return {
      status: "success",
      data,
      error: null,
    };
  } catch (err: any) {
    console.error("Action Error:", err);
    return {
      status: "error",
      data: null,
      error: {
        message: err.message?.includes("Failed query") ? "Gagal memproses permintaan ke database" : err.message || "Terjadi kesalahan internal",
        type: err.name,
        meta: err.fields,
      },
    };
  }
};

export const createMessage = async (
  userId: string,
  content: string,
  roomId: string,
  replyTo?: string,
  attachments?: { url: string; key: string; fileType: string; size?: number }[],
  optimisticId?: string
): Promise<ServerResponse<MessageWithUserDTO | null>> => {
  try {
    const actorId = await requireWriter(userId);
    await assertRoomMember(roomId, actorId);
    // A reply may only point at a message in the same room; otherwise it would
    // leak a quote of another room's message into this one.
    if (replyTo && (await getMessageRoomId(replyTo)) !== roomId) {
      throw new AuthorizationError("Pesan yang dibalas tidak ditemukan di room ini");
    }
    const data = await sendMessageController(actorId, content, roomId, replyTo, attachments, optimisticId);

    return {
      status: "success",
      data,
      error: null,
    };
  } catch (err: any) {
    console.error("Action Error:", err);
    return {
      status: "error",
      data: null,
      error: {
        message: err.message?.includes("Failed query") ? "Gagal memproses permintaan ke database" : err.message || "Terjadi kesalahan internal",
        type: err.name,
        meta: err.fields,
      },
    };
  }
};

export const getMessage = async (roomId: string, limit?: number, before?: Date, after?: Date) => {
  try {
    const viewerId = await requireReader();
    await assertCanReadRoom(roomId, viewerId);
    const message = await getMessageController(roomId, Math.min(limit ?? 50, 100), before, after);

    return {
      status: "success",
      data: message,
      error: null,
    };
  } catch (err: any) {
    console.error("Action Error:", err);
    return {
      status: "error",
      data: null,
      error: {
        message: err.message?.includes("Failed query") ? "Gagal memproses permintaan ke database" : err.message || "Terjadi kesalahan internal",
        type: err.name,
        meta: err.fields,
      },
    };
  }
};

/**
 * Catch a room up from a sync cursor: messages created or changed since
 * (edits, deletions, reactions), or the newest page when too much changed.
 * Used on reconnect/focus, where only fetching newer messages missed edits and
 * deletions made while the socket was down.
 */
export const syncRoomMessages = async (roomId: string, since?: Date | string | null) => {
  try {
    const viewerId = await requireReader();
    await assertCanReadRoom(roomId, viewerId);
    const sync = await syncRoomMessagesController(roomId, since ? new Date(since) : null);
    return { status: "success" as const, data: sync, error: null };
  } catch (err: any) {
    console.error("Action Error:", err);
    return {
      status: "error" as const,
      data: null,
      error: { message: err.message || "Terjadi kesalahan internal", type: err.name },
    };
  }
};

/** Pin or unpin a message (DM: both people; channel: owner or admin). */
export const togglePinAction = async (messageId: string) => {
  try {
    const actorId = await requireWriter();
    await assertMessageRoomMember(messageId, actorId);
    const { adminGuard } = await import("@/lib/middlewares/role-guard.middleware");
    const isAdmin = await adminGuard().catch(() => false);
    const result = await togglePinController(actorId, messageId, isAdmin);
    return { status: "success" as const, data: result, error: null };
  } catch (err: any) {
    console.error("Action Error:", err);
    return { status: "error" as const, data: null, error: { message: err.message || "Gagal menyematkan pesan", type: err.name } };
  }
};

/** Same folder rules as uploadFileAction. */
async function assertUploadDestination(destination: string | undefined, actorId: string) {
  const channelMatch = destination?.match(/^channels\/([A-Za-z0-9_-]+)$/);
  if (channelMatch) {
    await assertRoomMember(channelMatch[1], actorId);
  } else if (!destination || !UPLOAD_FOLDERS.has(destination)) {
    throw new AuthorizationError("Tujuan upload tidak valid");
  }
}

/**
 * Presigned URL for uploading straight from the browser to R2. Files never
 * pass through this server, so the ~4.5 MB Vercel request limit does not
 * apply. Same session and folder checks as uploadFileAction; type and size
 * are validated and baked into the signature.
 */
export const createUploadUrlAction = async (input: {
  destination: string;
  filename: string;
  contentType: string;
  size: number;
}): Promise<ServerResponse<{ uploadUrl: string; headers: Record<string, string>; fileurl: string; filename: string; key: string } | null>> => {
  try {
    const actorId = await requireWriter();
    await assertUploadDestination(input.destination, actorId);
    const data = await createUploadUrlController(input);
    return { status: "success", data, error: null };
  } catch (err: any) {
    console.error("Action Error:", err);
    return {
      status: "error",
      data: null,
      error: { message: err.message || "Gagal menyiapkan upload", type: err.name },
    };
  }
};

export const uploadFileAction = async (
  formData: FormData,
  destination?: string
): Promise<ServerResponse<{ fileurl: string; filename: string; size: number; mimetype: string } | null>> => {
  try {
    const actorId = await requireWriter();
    // Uploads land in a fixed set of folders. A channel folder additionally
    // requires membership, so nobody can write into another room's storage.
    if (destination) await assertUploadDestination(destination, actorId);
    const file = formData.get("file") as File;
    if (!file) {
      return {
        status: "error",
        data: null,
        error: { message: "No file provided", type: "ValidationError" },
      };
    }

    const data = await uploadFileController(file, destination);

    return {
      status: "success",
      data,
      error: null,
    };
  } catch (err: any) {
    console.error("Action Error:", err);
    return {
      status: "error",
      data: null,
      error: {
        message: err.message?.includes("Failed query") ? "Gagal memproses permintaan ke database" : err.message || "Terjadi kesalahan internal",
        type: err.name,
        meta: err.fields,
      },
    };
  }
};

export const updateLastReadAt = async (
  userId: string,
  roomId: string,
  messageId: string,
  lastReadAt?: Date
): Promise<ServerResponse<null>> => {
  try {
    const actor = await getActor();
    // An admin viewing as someone must not mark that person's messages read.
    if (actor.isImpersonating) return { status: "success", data: null, error: null };
    if (userId && userId !== actor.sessionUserId) throw new AuthorizationError();
    await assertRoomMember(roomId, actor.sessionUserId);

    await updateLastReadAtController(actor.sessionUserId, roomId, messageId, lastReadAt);

    // No revalidatePath here on purpose: read state is a hot, throttled path
    // (every viewport intersection, own-message receipt, visibilitychange and
    // unmount). Revalidating the whole (with-sidebar) layout re-ran the entire
    // server tree per event. Per docs/mark-as-read.md the authoritative sync is
    // the `room-marked-read` Pusher broadcast from the use case plus the local
    // UnreadProvider update, so the sidebar never depends on this revalidation.

    return {
      status: "success",
      data: null,
      error: null,
    };
  } catch (err: any) {
    console.error("Action Error:", err);
    return {
      status: "error",
      data: null,
      error: {
        message: err.message?.includes("Failed query") ? "Gagal memproses permintaan ke database" : err.message || "Terjadi kesalahan internal",
        type: err.name,
        meta: err.fields,
      },
    };
  }
};
export const getLastReadAt = async (
  userId: string,
  roomId: string
): Promise<ServerResponse<{ id: string | null; at: Date | null } | null>> => {
  try {
    const viewerId = await requireReader();
    const lastReadAt = await getLastReadAtController(viewerId, roomId);

    return {
      status: "success",
      data: lastReadAt,
      error: null,
    };
  } catch (err: any) {
    console.error("Action Error:", err);
    return {
      status: "error",
      data: null,
      error: {
        message: err.message?.includes("Failed query") ? "Gagal memproses permintaan ke database" : err.message || "Terjadi kesalahan internal",
        type: err.name,
        meta: err.fields,
      },
    };
  }
};
