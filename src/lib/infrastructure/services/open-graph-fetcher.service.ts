import "server-only";
import { ILinkPreviewFetcher } from "@/lib/application/services/link-preview-fetcher.interface";
import { LinkPreviewDTO } from "@/lib/entities/models/link-preview.model";
import { safeFetch } from "@/lib/net/safe-fetch";
import { parseOpenGraph } from "@/lib/chat/open-graph";

export class OpenGraphFetcher implements ILinkPreviewFetcher {
  async fetch(url: string): Promise<Omit<LinkPreviewDTO, "url"> | null> {
    const res = await safeFetch(url, {
      accept: "text/html,application/xhtml+xml",
      allowedType: /^(text\/html|application\/xhtml\+xml)$/i,
      maxBytes: 512 * 1024,
      // The tags live in <head>; no need to download the whole page.
      truncateAt: 256 * 1024,
      timeoutMs: 5000,
      maxRedirects: 3,
    });
    return parseOpenGraph(res.body.toString("utf8"), res.url.toString());
  }
}
