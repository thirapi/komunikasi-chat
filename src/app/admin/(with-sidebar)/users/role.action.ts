"use server";

import { requireAdmin } from "@/lib/auth/actor";

import { PermissionRecord } from "@/lib/entities/models/permission.model";
import { ServerResponse } from "@/lib/entities/models/response.model";
import { RoleFullRecord, RoleRecord } from "@/lib/entities/models/role.model";
import { getAllPermissionsController } from "@/lib/interface-adapters/controllers/permissions/get-all-permission.controller";
import { createRolesController } from "@/lib/interface-adapters/controllers/roles/create-roles.controller";
import { deleteRoleController } from "@/lib/interface-adapters/controllers/roles/delete-role.controller";
import { getAllRolesController } from "@/lib/interface-adapters/controllers/roles/get-all-roles.controller";
import { getAllUsersWithRolesController } from "@/lib/interface-adapters/controllers/roles/get-all-users-with-roles.controller";
import { getRoleByIdController } from "@/lib/interface-adapters/controllers/roles/get-role-by-id.controller";
import { updateRoleController } from "@/lib/interface-adapters/controllers/roles/update-role.controller";
import { updateUserRolesController } from "@/lib/interface-adapters/controllers/roles/update-user-roles.controller";
import { deleteUserController } from "@/lib/interface-adapters/controllers/users/delete-user.controller";
import { revalidatePath } from "next/cache";

export const getAllUsersWithRoles = async () => {
  await requireAdmin();
  const users = await getAllUsersWithRolesController();

  return users;
};

export const deleteUserAction = async (
  actorUserId: string,
  targetUserId: string
): Promise<ServerResponse<null>> => {
  try {
    const adminId = await requireAdmin(actorUserId);
    await deleteUserController(adminId, targetUserId);

    revalidatePath("/admin/users");

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

export const updateUserRolesAction = async (
  actorUserId: string,
  targetUserId: string,
  newRole: string[]
): Promise<ServerResponse<null>> => {
  try {
    // Previously unguarded and trusting actorUserId: any user could grant
    // themselves the admin role.
    const adminId = await requireAdmin(actorUserId);
    await updateUserRolesController(adminId, targetUserId, newRole);

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

export const getAllRolesAction = async () => {
  await requireAdmin();
  return await getAllRolesController();
};

export const getAllPermissionsAction = async (): Promise<ServerResponse<PermissionRecord[]>> => {
  try {
    await requireAdmin();
    const permission = await getAllPermissionsController();

    return {
      status: "success",
      data: permission,
      error: null,
    };
  } catch (err: any) {
    console.error(err);
    return {
      status: "error",
      data: [],
      error: {
        type: "UNKNOWN_ERROR",
        message: err.message || "Something went wrong",
      },
    };
  }
};

export const getRoleByIdAction = async (roleId: string): Promise<ServerResponse<RoleFullRecord | null>> => {
  try {
    await requireAdmin();
    const role = await getRoleByIdController(roleId);
    return {
      status: "success",
      data: role,
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
}  
    

export const createRoleAction = async (
  name: string,
  permissions: string[],
  description?: string
): Promise<ServerResponse<null>> => {
  try {
    await requireAdmin();
    const role = await createRolesController(name, permissions, description);

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
}

export const updateRoleAction = async (
  roleId: string,
  name: string,
  permissions: string[],
  description?: string
): Promise<ServerResponse<null>> => {
  try {
    await requireAdmin();
    const role = await updateRoleController(roleId, name, permissions, description);

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
}
export const deleteRoleAction = async (roleId: string): Promise<ServerResponse<null>> => {
  try {
    await requireAdmin();
    const role = await deleteRoleController(roleId);

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
}