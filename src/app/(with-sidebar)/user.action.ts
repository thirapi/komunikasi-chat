"use server";

import { getOptionalViewer, requireReader, requireWriter } from "@/lib/auth/actor";
import { getPrivacyController, updatePrivacyController } from "@/lib/interface-adapters/controllers/users/privacy-settings.controller";
import { blockUserController } from "@/lib/interface-adapters/controllers/users/block-user.controller";
import { ServerResponse } from "@/lib/entities/models/response.model";
import { UserRecord } from "@/lib/entities/models/user.model";
import { AttachmentWithMessageDTO } from "@/lib/entities/models/attachment.model";
import { updateUserController } from "@/lib/interface-adapters/controllers/users/update.controller";
import { searchUserController } from "@/lib/interface-adapters/controllers/users/search.controller";
import { changePasswordController } from "@/lib/interface-adapters/controllers/users/change-password.controller";
import { getProfileController } from "@/lib/interface-adapters/controllers/users/get-profile.controller";
import { getSharedMediaController } from "@/lib/interface-adapters/controllers/users/get-shared-media.controller";

export const updateUserAction = async (
  userId: string,
  user: Partial<UserRecord>
): Promise<ServerResponse<null>> => {
  try {
    const actorId = await requireWriter(userId);
    await updateUserController(actorId, user);

    return {
      status: "success",
      data: null,
      error: null,
    };
  } catch (err: any) {
    console.error(err);
    return {
      status: "error",
      data: null,
      error: {
        type: "UNKNOWN_ERROR",
        message: err.message || "Something went wrong",
      },
    };
  }
};

export const changePasswordAction = async (
  userId: string,
  data: { oldPassword?: string; newPassword: string }
): Promise<ServerResponse<null>> => {
  try {
    const actorId = await requireWriter(userId);
    await changePasswordController(actorId, data);
    return {
      status: "success",
      data: null,
      error: null,
    };
  } catch (err: any) {
    return {
      status: "error",
      data: null,
      error: {
        type: "VALIDATION_ERROR",
        message: err.message,
      },
    };
  }
};

export const searchUsersAction = async (query: string): Promise<ServerResponse<{ id: string; username: string; avatar: string }[]>> => {
  try {
    // No session/role lookup here: this action runs on every debounced
    // keystroke in the user search dialogs, and SearchUserUseCase does not
    // consume the caller's identity. It was costing a full session + roles
    // lookup (~6 queries) per character typed.
    // Only the cheap session check (cached per request), not the roles lookup.
    await requireReader();
    const users = await searchUserController(query, 10);
    return {
      status: "success",
      data: users as any,
      error: null,
    };
  } catch (err: any) {
    return {
      status: "error",
      data: [],
      error: {
        type: "UNKNOWN_ERROR",
        message: err.message,
      },
    };
  }
};

export const getPublicProfileAction = async (username: string, currentUserId?: string): Promise<ServerResponse<any>> => {
  try {
    // Profiles are public; the viewer (if any) only personalises the result.
    const user = await getProfileController(username, (await getOptionalViewer()) ?? undefined);
    return {
      status: "success",
      data: user,
      error: null,
    };
  } catch (err: any) {
    return {
      status: "error",
      data: null,
      error: {
        type: "UNKNOWN_ERROR",
        message: err.message || "User not found",
      },
    };
  }
};

export const getSharedMediaAction = async (currentUserId: string, profileUsername: string): Promise<ServerResponse<AttachmentWithMessageDTO[]>> => {
  try {
    // "Shared" media is between the viewer and that profile, so it needs a viewer.
    const viewerId = await getOptionalViewer();
    if (!viewerId) return { status: "success", data: [], error: null };
    const media = await getSharedMediaController(viewerId, profileUsername);
    return {
      status: "success",
      data: media,
      error: null,
    };
  } catch (err: any) {
    return {
      status: "error",
      data: [],
      error: {
        type: "UNKNOWN_ERROR",
        message: err.message || "Failed to load media",
      },
    };
  }
};

/** Block or unblock a user (closes your DM with them both ways). */
export const setUserBlockedAction = async (targetUserId: string, block: boolean) => {
  try {
    const actorId = await requireWriter();
    const status = await blockUserController(actorId, targetUserId, block);
    return { status: "success" as const, data: status, error: null };
  } catch (err: any) {
    return { status: "error" as const, data: null, error: { message: err.message || "Gagal memperbarui blokir", type: err.name } };
  }
};

/** The signed-in user's privacy settings. */
export const getPrivacyAction = async () => {
  try {
    const actorId = await requireWriter();
    return { status: "success" as const, data: await getPrivacyController(actorId), error: null };
  } catch (err: any) {
    return { status: "error" as const, data: null, error: { message: err.message, type: err.name } };
  }
};

/** Update last-seen / read-receipt visibility (both reciprocal). */
export const updatePrivacyAction = async (patch: { showLastSeen?: boolean; readReceipts?: boolean }) => {
  try {
    const actorId = await requireWriter();
    return { status: "success" as const, data: await updatePrivacyController(actorId, patch ?? {}), error: null };
  } catch (err: any) {
    return { status: "error" as const, data: null, error: { message: err.message || "Gagal menyimpan", type: err.name } };
  }
};
