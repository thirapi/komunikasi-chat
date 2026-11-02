import { describe, it, expect, vi } from "vitest";
import { TogglePinUseCase, MAX_PINS } from "../toggle-pin.use-case";

const pin = (id: string) => ({ id, content: id, userId: "u2", user: { username: "b", name: null }, createdAt: new Date(), pinnedAt: new Date(), attachmentType: null });

function setup(opts: { isDirect?: boolean; ownerId?: string | null; isMember?: boolean; pinnedAt?: Date | null; existing?: string[] }) {
  const messages = {
    getMessageById: vi.fn().mockResolvedValue({ id: "m1", roomId: "r1", pinnedAt: opts.pinnedAt ?? null }),
    getPinnedMessages: vi.fn().mockResolvedValue((opts.existing ?? []).map(pin)),
    setPinned: vi.fn(),
  };
  const rooms = {
    getRoomAccess: vi.fn().mockResolvedValue({
      exists: true, isMember: opts.isMember ?? true, isPublic: false, isDirect: opts.isDirect ?? false, ownerId: opts.ownerId ?? null,
    }),
  };
  const pusher = { trigger: vi.fn() };
  return { useCase: new TogglePinUseCase(messages as any, rooms as any, pusher), messages, pusher };
}

describe("TogglePinUseCase", () => {
  it("lets either person pin in a DM and broadcasts the list", async () => {
    const { useCase, messages, pusher } = setup({ isDirect: true });
    const res = await useCase.execute("u1", "m1", { isAdmin: false });
    expect(res.pinned).toBe(true);
    expect(messages.setPinned).toHaveBeenCalledWith("m1", "u1");
    expect(pusher.trigger).toHaveBeenCalledWith(expect.stringContaining("r1"), "pins-changed", expect.objectContaining({ roomId: "r1" }));
  });

  it("allows the channel owner and admins, not other members", async () => {
    await expect(setup({ ownerId: "u1" }).useCase.execute("u1", "m1", { isAdmin: false })).resolves.toBeTruthy();
    await expect(setup({ ownerId: "x" }).useCase.execute("u1", "m1", { isAdmin: true })).resolves.toBeTruthy();
    const member = setup({ ownerId: "x" });
    await expect(member.useCase.execute("u1", "m1", { isAdmin: false })).rejects.toThrow(/pemilik atau admin/);
    expect(member.messages.setPinned).not.toHaveBeenCalled();
  });

  it("rejects non-members", async () => {
    await expect(setup({ isDirect: true, isMember: false }).useCase.execute("u1", "m1", { isAdmin: true })).rejects.toThrow();
  });

  it("unpins a pinned message", async () => {
    const { useCase, messages } = setup({ isDirect: true, pinnedAt: new Date() });
    const res = await useCase.execute("u1", "m1", { isAdmin: false });
    expect(res.pinned).toBe(false);
    expect(messages.setPinned).toHaveBeenCalledWith("m1", null);
  });

  it(`replaces the oldest pin past ${MAX_PINS}`, async () => {
    const { useCase, messages } = setup({ isDirect: true, existing: ["p5", "p4", "p3", "p2", "p1"] });
    await useCase.execute("u1", "m1", { isAdmin: false });
    expect(messages.setPinned).toHaveBeenCalledWith("p1", null);
    expect(messages.setPinned).not.toHaveBeenCalledWith("p2", null);
    expect(messages.setPinned).toHaveBeenCalledWith("m1", "u1");
  });
});
