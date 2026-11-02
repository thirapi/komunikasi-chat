import { describe, it, expect, vi } from "vitest";
import { ChatListActionsUseCase, MAX_PINNED_CHATS } from "../chat-list-actions.use-case";

function setup(pinnedCount = 0, lastReadAt: Date | null = null) {
  const rooms = {
    setChatPinned: vi.fn(),
    countPinnedChats: vi.fn().mockResolvedValue(pinnedCount),
    setMarkedUnread: vi.fn(),
    updateLastReadAt: vi.fn(),
    getLastReadAt: vi.fn().mockResolvedValue({ id: null, at: lastReadAt }),
  };
  const pusher = { triggerToUsers: vi.fn() };
  const messages = { getMessagesByRoomId: vi.fn().mockResolvedValue([{ id: "m9", createdAt: new Date("2026-11-02T10:00:00Z") }]) };
  return { uc: new ChatListActionsUseCase(rooms as any, pusher, messages as any), rooms, pusher };
}

describe("ChatListActionsUseCase", () => {
  it("pins a chat and tells the user's devices", async () => {
    const { uc, rooms, pusher } = setup();
    const at = await uc.setPinned("u1", "r1", true);
    expect(rooms.setChatPinned).toHaveBeenCalledWith("u1", "r1", at);
    expect(pusher.triggerToUsers).toHaveBeenCalledWith(["u1"], "chat-list-changed", { roomId: "r1", pinnedAt: at });
  });

  it(`refuses a ${MAX_PINNED_CHATS + 1}th pin but always allows unpinning`, async () => {
    await expect(setup(MAX_PINNED_CHATS).uc.setPinned("u1", "r1", true)).rejects.toThrow(/Maksimal/);
    await expect(setup(MAX_PINNED_CHATS).uc.setPinned("u1", "r1", false)).resolves.toBeNull();
  });

  it("marks read from the list up to the newest message and clears the manual mark", async () => {
    const { uc, rooms, pusher } = setup(0, new Date("2026-11-01T00:00:00Z"));
    await uc.markRead("u1", "r1");
    expect(rooms.setMarkedUnread).toHaveBeenCalledWith("u1", "r1", false);
    expect(rooms.updateLastReadAt).toHaveBeenCalledWith("u1", "r1", "m9", new Date("2026-11-02T10:00:00Z"));
    expect(pusher.triggerToUsers).toHaveBeenCalledWith(["u1"], "room-marked-read", { roomId: "r1" });
  });

  it("does not move the read position backwards", async () => {
    const { uc, rooms } = setup(0, new Date("2026-11-03T00:00:00Z"));
    await uc.markRead("u1", "r1");
    expect(rooms.updateLastReadAt).not.toHaveBeenCalled();
  });
});
