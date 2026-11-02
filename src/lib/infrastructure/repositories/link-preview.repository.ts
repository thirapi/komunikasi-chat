import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { linkPreviews } from "@/lib/infrastructure/drizzle/schema";
import { CachedLinkPreview, ILinkPreviewRepository } from "@/lib/application/repositories/link-preview.repository.interface";
import { LinkPreviewDTO } from "@/lib/entities/models/link-preview.model";

export class LinkPreviewRepository implements ILinkPreviewRepository {
  constructor(private client: typeof db) {}

  async get(url: string): Promise<CachedLinkPreview | null> {
    const row = await this.client.query.linkPreviews.findFirst({ where: eq(linkPreviews.url, url) });
    if (!row) return null;
    return {
      fetchedAt: row.fetchedAt,
      preview:
        row.status === "ok"
          ? { url, title: row.title, description: row.description, image: row.image, siteName: row.siteName }
          : null,
    };
  }

  async save(url: string, preview: Omit<LinkPreviewDTO, "url"> | null): Promise<void> {
    const values = {
      status: preview ? "ok" : "none",
      title: preview?.title ?? null,
      description: preview?.description ?? null,
      image: preview?.image ?? null,
      siteName: preview?.siteName ?? null,
      fetchedAt: new Date(),
    };
    await this.client
      .insert(linkPreviews)
      .values({ url, ...values })
      .onConflictDoUpdate({ target: linkPreviews.url, set: values });
  }
}
