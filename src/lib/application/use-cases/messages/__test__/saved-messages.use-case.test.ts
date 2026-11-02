import { describe, it, expect, vi } from "vitest";
import { SavedMessagesUseCase } from "../saved-messages.use-case";

function setup(opts: { saved?: boolean; member?: boolean; exists?: boolean }) {
  const saved = {
    isSaved: vi.fn().mockResolvedValue(opts.saved ?? false),
    save: vi.fn(),
    unsave: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
    listIds: vi.fn().mockResolvedValue([]),
  };
  const messages = { getMessageById: vi.fn().mockResolvedValue(opts.exists === false ? null : { id: "m1", roomId: "r1" }) };
  const rooms = { getRoomAccess: vi.fn().mockResolvedValue({ isMember: opts.member ?? true }) };
  return { uc: new SavedMessagesUseCase(saved, messages as any, rooms as any), saved };
}

describe("SavedMessagesUseCase", () => {
  it("saves a message the user can read", async () => {
    const { uc, saved } = setup({});
    expect(await uc.toggle("u1", "m1")).toBe(true);
    expect(saved.save).toHaveBeenCalledWith("u1", "m1");
  });

  it("unsaves an already saved message", async () => {
    const { uc, saved } = setup({ saved: true });
    expect(await uc.toggle("u1", "m1")).toBe(false);
    expect(saved.unsave).toHaveBeenCalledWith("u1", "m1");
  });

  it("refuses messages from rooms the user is not in, or that do not exist", async () => {
    await expect(setup({ member: false }).uc.toggle("u1", "m1")).rejects.toThrow();
    await expect(setup({ exists: false }).uc.toggle("u1", "m1")).rejects.toThrow();
  });
});
