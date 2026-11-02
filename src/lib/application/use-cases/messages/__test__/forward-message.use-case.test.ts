import { describe, it, expect, vi } from "vitest";
import { ForwardMessageUseCase, MAX_FORWARD_TARGETS } from "../forward-message.use-case";

function setup(opts: { content?: string; attachments?: any[]; member?: (roomId: string) => boolean; extra?: Record<string, unknown> } = {}) {
  const messages = {
    getMessageById: vi.fn().mockResolvedValue({
      id: "m1",
      roomId: "src",
      userId: "author",
      content: opts.content ?? "halo",
      attachments: opts.attachments ?? [],
      ...opts.extra,
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

  it("credits the original author, also when a forward is forwarded again", async () => {
    expect((await setup().prepare("u1", "m1", ["a"])).forwardedFromUserId).toBe("author");
    const again = await setup({ extra: { forwardedFromUserId: "first" } }).prepare("u1", "m1", ["a"]);
    expect(again.forwardedFromUserId).toBe("first");
  });

  it("re-posts a poll as a new poll", async () => {
    const poll = { question: "Kapan?", allowMultiple: true, options: [{ text: "Senin", votes: [{}] }, { text: "Selasa", votes: [] }] };
    const res = await setup({ content: "📊 Kapan?", extra: { poll } }).prepare("u1", "m1", ["a"]);
    expect(res.poll).toEqual({ question: "Kapan?", options: ["Senin", "Selasa"], allowMultiple: true });
  });

  it("carries an optional comment, trimmed", async () => {
    expect((await setup().prepare("u1", "m1", ["a"], "  lihat ini  ")).comment).toBe("lihat ini");
    expect((await setup().prepare("u1", "m1", ["a"], "   ")).comment).toBeUndefined();
  });
});
