"use server";

import { requireReader } from "@/lib/auth/actor";
import { getLinkPreviewController } from "@/lib/interface-adapters/controllers/messages/get-link-preview.controller";
import type { LinkPreviewDTO } from "@/lib/entities/models/link-preview.model";

/** Preview card for a link in a message. Signed-in users only (not an open fetcher). */
export async function getLinkPreviewAction(url: string): Promise<LinkPreviewDTO | null> {
  try {
    await requireReader();
    return await getLinkPreviewController(url);
  } catch {
    return null;
  }
}
