import { db } from "@/lib/db";
import { LinkPreviewRepository } from "@/lib/infrastructure/repositories/link-preview.repository";
import { OpenGraphFetcher } from "@/lib/infrastructure/services/open-graph-fetcher.service";
import { GetLinkPreviewUseCase } from "@/lib/application/use-cases/messages/get-link-preview.use-case";

const getLinkPreviewUseCase = new GetLinkPreviewUseCase(new LinkPreviewRepository(db), new OpenGraphFetcher());

export async function getLinkPreviewController(url: string) {
  if (typeof url !== "string" || url.length > 2048) return null;
  return getLinkPreviewUseCase.execute(url);
}
