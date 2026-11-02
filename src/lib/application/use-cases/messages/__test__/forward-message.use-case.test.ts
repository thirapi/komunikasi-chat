import { describe, it, expect, vi } from "vitest";
import { ForwardMessageUseCase, MAX_FORWARD_TARGETS } from "../forward-message.use-case";

function setup(opts: { content?: string; attachments?: any[]; member?: (roomId: string) => boolean } = {}) {
  const messages = {
    getMessageById: vi.fn().mockResolvedValue({
      id: "m1",
      roomId: "src",
      content: opts.content ?? "halo",
      attachments: opts.attachments ?? [],
    }),
  };
  const member = opts.member ?? (() => true);
  const rooms = {
    getRoomAccess: vi.fn().mockImplementation(async (roomId: string) => ({
      exists: true, isMember: member(roomId), isPublic: false, isDirect: false, ownerId: null,
    })),
  };
  const users = { findById: vi.fn().mockImplementation(async (id: string) => (id === "u9" ? { username: "budi" } : null)) };
  return new ForwardMessageUseCase(messages as any, rooms as any, users as any);
}

describe("ForwardMessageUseCase", () => {
  it("builds the payload from the stored message", async () => {
    const att = { url: "https://cdn/x.png", key: "x.png", fileType: "image/png", size: 10, id: "a1" };
    const res = await setup({ attachments: [att] }).prepare("u1", "m1", ["a", "b", "a"]);
    expect(res.targetRoomIds).toEqual(["a", "b"]);
    expect(res.attachments).toEqual([{ url: att.url, key: att.key, fileType: att.fileType, size: 10 }]);
  });

  it("turns mentions into plain text so nobody is pinged", async () => {
    const res = await setup({ content: "<@everyone> lihat <@u9> dan <@gone>" }).prepare("u1", "m1", ["a"]);
    expect(res.content).toBe("@everyone lihat @budi dan @pengguna");
    expect(res.content).not.toMatch(/<@/);
  });

  it(`refuses more than ${MAX_FORWARD_TARGETS} targets or none`, async () => {
    await expect(setup().prepare("u1", "m1", ["1", "2", "3", "4", "5", "6"])).rejects.toThrow(/Maksimal/);
    await expect(setup().prepare("u1", "m1", [])).rejects.toThrow();
  });

  it("requires membership of the source and every target", async () => {
    await expect(setup({ member: (r) => r !== "src" }).prepare("u1", "m1", ["a"])).rejects.toThrow();
    await expect(setup({ member: (r) => r !== "b" }).prepare("u1", "m1", ["a", "b"])).rejects.toThrow(/tujuan/);
  });
});
