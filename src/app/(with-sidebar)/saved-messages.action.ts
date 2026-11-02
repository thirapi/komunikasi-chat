"use server";

import { requireWriter } from "@/lib/auth/actor";
import {
  listSavedMessageIdsController,
  listSavedMessagesController,
  toggleSavedMessageController,
} from "@/lib/interface-adapters/controllers/messages/saved-messages.controller";

export async function toggleSavedMessageAction(messageId: string) {
  try {
    const userId = await requireWriter();
    return { status: "success" as const, data: { saved: await toggleSavedMessageController(userId, messageId) }, error: null };
  } catch (err: any) {
    return { status: "error" as const, data: null, error: { message: err.message || "Gagal menyimpan pesan", type: err.name } };
  }
}

export async function listSavedMessagesAction() {
  try {
    const userId = await requireWriter();
    return { status: "success" as const, data: await listSavedMessagesController(userId), error: null };
  } catch (err: any) {
    return { status: "error" as const, data: null, error: { message: err.message, type: err.name } };
  }
}

export async function listSavedMessageIdsAction(): Promise<string[]> {
  try {
    return await listSavedMessageIdsController(await requireWriter());
  } catch {
    return [];
  }
}
