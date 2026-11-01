"use server";

import { requireAdmin } from "@/lib/auth/actor";

import { getAllSessionsController } from "@/lib/interface-adapters/controllers/get-all-sessions.controller";
import { getAllActivityLogsController } from "@/lib/interface-adapters/controllers/admin/get-all-activity-logs.controller";

export const getAllSessionsAction = async () => {
  await requireAdmin();
  const users = await getAllSessionsController();

  return users;
};

export const getAllActivityLogsAction = async () => {
  await requireAdmin();
  return await getAllActivityLogsController();
};
