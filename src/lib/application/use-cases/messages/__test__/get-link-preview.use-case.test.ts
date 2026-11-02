import { describe, it, expect, vi } from "vitest";
import { GetLinkPreviewUseCase, normalizePreviewUrl } from "../get-link-preview.use-case";

const DAY = 24 * 60 * 60 * 1000;
const page = { title: "Judul", description: "Desk", image: null, siteName: "example.com" };

function setup(cached: { preview: any; fetchedAt: Date } | null, fetched: any = page) {
  const repo = { get: vi.fn().mockResolvedValue(cached), save: vi.fn().mockResolvedValue(undefined) };
  const fetcher = { fetch: vi.fn().mockResolvedValue(fetched) };
  return { useCase: new GetLinkPreviewUseCase(repo, fetcher), repo, fetcher };
}

describe("normalizePreviewUrl", () => {
  it("keeps http(s), drops the fragment, rejects the rest", () => {
    expect(normalizePreviewUrl("https://example.com/a#b")).toBe("https://example.com/a");
    expect(normalizePreviewUrl("javascript:alert(1)")).toBeNull();
    expect(normalizePreviewUrl("https://user:pw@example.com")).toBeNull();
    expect(normalizePreviewUrl("not a url")).toBeNull();
  });
});

describe("GetLinkPreviewUseCase", () => {
  it("fetches, stores and returns a new preview", async () => {
    const { useCase, repo } = setup(null);
    expect(await useCase.execute("https://example.com/x")).toEqual({ url: "https://example.com/x", ...page });
    expect(repo.save).toHaveBeenCalledWith("https://example.com/x", page);
  });

  it("serves a fresh cache without fetching", async () => {
    const cached = { preview: { url: "https://example.com/x", ...page }, fetchedAt: new Date(Date.now() - DAY) };
    const { useCase, fetcher } = setup(cached);
    expect(await useCase.execute("https://example.com/x")).toEqual(cached.preview);
    expect(fetcher.fetch).not.toHaveBeenCalled();
  });

  it("refetches a stale cache, and retries empty results sooner", async () => {
    const stale = setup({ preview: { url: "u", ...page }, fetchedAt: new Date(Date.now() - 8 * DAY) });
    await stale.useCase.execute("https://example.com/x");
    expect(stale.fetcher.fetch).toHaveBeenCalled();
    const emptyRecent = setup({ preview: null, fetchedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) });
    expect(await emptyRecent.useCase.execute("https://example.com/x")).toBeNull();
    expect(emptyRecent.fetcher.fetch).not.toHaveBeenCalled();
    const emptyOld = setup({ preview: null, fetchedAt: new Date(Date.now() - 2 * DAY) });
    await emptyOld.useCase.execute("https://example.com/x");
    expect(emptyOld.fetcher.fetch).toHaveBeenCalled();
  });

  it("remembers pages with nothing to show, and fetch failures", async () => {
    const empty = setup(null, { title: null, description: null, image: null, siteName: "x" });
    expect(await empty.useCase.execute("https://example.com/x")).toBeNull();
    expect(empty.repo.save).toHaveBeenCalledWith("https://example.com/x", null);
    const failing = setup(null);
    failing.fetcher.fetch.mockRejectedValue(new Error("blocked"));
    expect(await failing.useCase.execute("https://10.0.0.1/")).toBeNull();
    expect(failing.repo.save).toHaveBeenCalledWith("https://10.0.0.1/", null);
  });
});
