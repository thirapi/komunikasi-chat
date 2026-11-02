import { LinkPreviewDTO } from "@/lib/entities/models/link-preview.model";

export interface CachedLinkPreview {
  preview: LinkPreviewDTO | null;
  fetchedAt: Date;
}

export interface ILinkPreviewRepository {
  get(url: string): Promise<CachedLinkPreview | null>;
  /** Store a result; null preview means "fetched, nothing to show". */
  save(url: string, preview: Omit<LinkPreviewDTO, "url"> | null): Promise<void>;
}
