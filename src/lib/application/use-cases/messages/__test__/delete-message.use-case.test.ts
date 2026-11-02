import { describe, it, expect, vi } from "vitest";
import { DeleteMessageUseCase } from "../delete-message.use-case";

const BASE = "https://cdn.example.com";
const url = (key: string) => `${BASE}/${encodeURI(key)}`;

function setup(opts: { attachments: string[]; inUse?: string[]; ownerId?: string; deleteFails?: boolean }) {
  const messageRepository = {
    getMessageById: vi.fn().mockResolvedValue({
      id: "m1",
      userId: opts.ownerId ?? "u1",
      roomId: "r1",
      createdAt: new Date(),
      attachments: opts.attachments.map((u, i) => ({ id: `a${i}`, url: u, key: "x", fileType: "image/png" })),
    }),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    getAttachmentUrlsInUse: vi.fn().mockResolvedValue(opts.inUse ?? []),
  } as any;
  const roomRepository = {
    fallbackLastReadMessageId: vi.fn(),
    getOtherParticipants: vi.fn().mockResolvedValue([]),
  } as any;
  const pusher = { trigger: vi.fn(), triggerToUsers: vi.fn() } as any;
  const storage = {
    keyFromPublicUrl: (u: string) => (u.startsWith(`${BASE}/`) ? decodeURI(u.slice(BASE.length + 1)) : null),
    deleteFile: opts.deleteFails ? vi.fn().mockRejectedValue(new Error("r2 down")) : vi.fn().mockResolvedValue(undefined),
  };
  const useCase = new DeleteMessageUseCase(messageRepository, roomRepository, pusher, storage);
  return { useCase, storage, messageRepository };
}

describe("DeleteMessageUseCase storage cleanup", () => {
  it("removes the message's files from storage", async () => {
    const { useCase, storage } = setup({ attachments: [url("channels/r1/1-foto saya.png"), url("channels/r1/2-b.mp4")] });
    await useCase.execute("u1", "m1");
    expect(storage.deleteFile).toHaveBeenCalledWith("channels/r1/1-foto saya.png");
    expect(storage.deleteFile).toHaveBeenCalledWith("channels/r1/2-b.mp4");
  });

  it("never touches files outside this room's folder or on another host", async () => {
    const { useCase, storage } = setup({
      attachments: [
        url("avatars/1-victim.png"),
        url("channels/other-room/1-x.png"),
        "https://evil.example.com/channels/r1/1-x.png",
        "/api/media-proxy?url=abc",
      ],
    });
    await useCase.execute("u1", "m1");
    expect(storage.deleteFile).not.toHaveBeenCalled();
  });

  it("keeps a file another message still uses", async () => {
    const shared = url("channels/r1/1-shared.png");
    const own = url("channels/r1/2-own.png");
    const { useCase, storage, messageRepository } = setup({ attachments: [shared, own], inUse: [shared] });
    await useCase.execute("u1", "m1");
    expect(messageRepository.getAttachmentUrlsInUse).toHaveBeenCalledWith([shared, own], "m1");
    expect(storage.deleteFile).toHaveBeenCalledTimes(1);
    expect(storage.deleteFile).toHaveBeenCalledWith("channels/r1/2-own.png");
  });

  it("still deletes the message when storage fails", async () => {
    const { useCase, messageRepository } = setup({ attachments: [url("channels/r1/1-a.png")], deleteFails: true });
    await expect(useCase.execute("u1", "m1")).resolves.toBeUndefined();
    expect(messageRepository.deleteMessage).toHaveBeenCalledWith("m1");
  });

  it("does nothing to storage when someone else tries to delete", async () => {
    const { useCase, storage } = setup({ attachments: [url("channels/r1/1-a.png")], ownerId: "owner" });
    await expect(useCase.execute("u1", "m1")).rejects.toThrow();
    expect(storage.deleteFile).not.toHaveBeenCalled();
  });
});
