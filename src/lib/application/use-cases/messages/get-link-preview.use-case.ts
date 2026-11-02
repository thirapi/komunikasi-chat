import { LinkPreviewDTO } from "@/lib/entities/models/link-preview.model";
import { ILinkPreviewRepository } from "../../repositories/link-preview.repository.interface";
import { ILinkPreviewFetcher } from "../../services/link-preview-fetcher.interface";

const DAY = 24 * 60 * 60 * 1000;
/** A page's title and image rarely change; a failed fetch is retried sooner. */
const FRESH_OK = 7 * DAY;
const FRESH_EMPTY = DAY;

/** Strip what does not change the page (fragment) and reject non-http(s). */
export function normalizePreviewUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    url.hash = "";
    const s = url.toString();
    return s.length > 2048 ? null : s;
  } catch {
    return null;
  }
}

/**
 * Preview card data for a link in a message. Fetched once on the server and
 * cached for everyone, so a link posted in a busy channel is not fetched by
 * every viewer, and the viewer's IP never reaches the linked site.
 */
export class GetLinkPreviewUseCase {
  constructor(
    private repository: ILinkPreviewRepository,
    private fetcher: ILinkPreviewFetcher,
  ) {}

  async execute(rawUrl: string): Promise<LinkPreviewDTO | null> {
    const url = normalizePreviewUrl(rawUrl);
    if (!url) return null;

    const cached = await this.repository.get(url);
    if (cached) {
      const age = Date.now() - cached.fetchedAt.getTime();
      if (age < (cached.preview ? FRESH_OK : FRESH_EMPTY)) return cached.preview;
    }

    let preview: Omit<LinkPreviewDTO, "url"> | null = null;
    try {
      preview = await this.fetcher.fetch(url);
    } catch {
      preview = null;
    }
    // A preview with nothing to show is stored as "none" so it is not refetched.
    if (preview && !preview.title && !preview.description && !preview.image) preview = null;
    await this.repository.save(url, preview).catch(() => {});
    return preview ? { url, ...preview } : null;
  }
}
