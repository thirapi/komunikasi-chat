import { describe, it, expect, vi } from "vitest";
import { CreateUploadUrlUseCase } from "../create-upload-url.use-case";

const storage = {
  createUploadUrl: vi.fn().mockResolvedValue({ uploadUrl: "u", headers: {}, fileurl: "f", filename: "n", key: "k" }),
} as any;

describe("CreateUploadUrlUseCase", () => {
  const useCase = new CreateUploadUrlUseCase(storage);

  it.each(["image/png", "image/jpeg", "video/mp4", "application/pdf", "text/plain"])("allows %s", async (contentType) => {
    await expect(useCase.execute({ destination: "channels/r1", filename: "a", contentType, size: 10 })).resolves.toBeTruthy();
  });

  it.each(["text/html", "image/svg+xml", "application/javascript", ""])("rejects %s", async (contentType) => {
    await expect(useCase.execute({ destination: "channels/r1", filename: "a", contentType, size: 10 })).rejects.toThrow();
  });
});
