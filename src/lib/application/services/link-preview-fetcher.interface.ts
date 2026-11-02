import { LinkPreviewDTO } from "@/lib/entities/models/link-preview.model";

export interface ILinkPreviewFetcher {
  /** Fetch and parse a page's preview; null when there is nothing to show. */
  fetch(url: string): Promise<Omit<LinkPreviewDTO, "url"> | null>;
}
