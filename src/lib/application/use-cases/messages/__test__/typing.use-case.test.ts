import { describe, it, expect, vi } from "vitest";
import { TypingUseCase, SIDEBAR_TYPING_MAX_MEMBERS } from "../typing.use-case";

const pusher = () => ({ trigger: vi.fn(), triggerToUsers: vi.fn() }) as any;
const users = { findById: vi.fn().mockResolvedValue({ id: "u1", username: "budi", name: "Budi" }) } as any;
const rooms = (n: number) => ({
  getParticipantIds: vi.fn().mockResolvedValue(["u1", ...Array.from({ length: n - 1 }, (_, i) => `m${i}`)]),
});

describe("TypingUseCase", () => {
  it("also tells the other members' chat lists in a DM", async () => {
    const p = pusher();
    await new TypingUseCase(p, users, rooms(2)).startTyping("u1", "r1");
    expect(p.trigger).toHaveBeenCalledWith(expect.stringContaining("r1"), "user-typing", expect.objectContaining({ typing: true }));
    expect(p.triggerToUsers).toHaveBeenCalledWith(["m0"], "room-typing", expect.objectContaining({ roomId: "r1", userId: "u1", name: "Budi", typing: true }));
  });

  it("sends stop to the chat lists too", async () => {
    const p = pusher();
    await new TypingUseCase(p, users, rooms(3)).stopTyping("u1", "r1");
    expect(p.triggerToUsers).toHaveBeenCalledWith(["m0", "m1"], "room-typing", expect.objectContaining({ typing: false }));
  });

  it("keeps typing inside the room for big rooms", async () => {
    const p = pusher();
    await new TypingUseCase(p, users, rooms(SIDEBAR_TYPING_MAX_MEMBERS + 1)).startTyping("u1", "r1");
    expect(p.trigger).toHaveBeenCalled();
    expect(p.triggerToUsers).not.toHaveBeenCalled();
  });
});
