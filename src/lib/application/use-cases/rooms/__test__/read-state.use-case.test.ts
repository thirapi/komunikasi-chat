import { describe, it, expect, vi } from "vitest";
import { UpdateLastReadAtUseCase } from "../update-last-read-at.use-case";
import { GetSidebarDataUseCase } from "../get-sidebar-data.use-case";
import { ToggleReactionUseCase } from "../../messages/toggle-reaction.use-case";

function roomRepo(isDirect: boolean, currentAt: Date | null = null) {
  return {
    getLastReadAt: vi.fn().mockResolvedValue({ id: null, at: currentAt }),
    updateLastReadAt: vi.fn().mockResolvedValue(undefined),
    getRoomAccess: vi.fn().mockResolvedValue({ exists: true, isMember: true, isPublic: false, isDirect, ownerId: null }),
  } as any;
}
const pusher = () => ({ trigger: vi.fn(), triggerToUsers: vi.fn() }) as any;

describe("UpdateLastReadAtUseCase", () => {
  it("sends a read receipt to the room channel in a DM", async () => {
    const p = pusher();
    const at = new Date("2026-11-02T10:00:00Z");
    await new UpdateLastReadAtUseCase(roomRepo(true), p).execute("u1", "r1", "m1", at);
    expect(p.triggerToUsers).toHaveBeenCalledWith(["u1"], "room-marked-read", expect.objectContaining({ roomId: "r1" }));
    expect(p.trigger).toHaveBeenCalledWith(
      expect.stringContaining("r1"),
      "read-receipt",
      { userId: "u1", messageId: "m1", lastReadAt: at },
    );
  });

  it("does not broadcast read receipts in channels", async () => {
    const p = pusher();
    await new UpdateLastReadAtUseCase(roomRepo(false), p).execute("u1", "r1", "m1", new Date());
    expect(p.trigger).not.toHaveBeenCalled();
  });

  it("ignores an older read position", async () => {
    const p = pusher();
    const repo = roomRepo(true, new Date("2026-11-02T10:00:00Z"));
    await new UpdateLastReadAtUseCase(repo, p).execute("u1", "r1", "m0", new Date("2026-11-02T09:00:00Z"));
    expect(repo.updateLastReadAt).not.toHaveBeenCalled();
    expect(p.trigger).not.toHaveBeenCalled();
  });
});

describe("GetSidebarDataUseCase unread count", () => {
  const row = (over: Record<string, unknown>) => ({
    roomId: "r1", roomName: "general", roomAvatar: "", isDirect: false,
    lastReadAt: new Date("2026-11-02T09:00:00Z"),
    lastMessageId: "m2", lastMessageContent: "hi", lastMessageUserId: "u2",
    lastMessageCreatedAt: new Date("2026-11-02T10:00:00Z"),
    lastMessageAttachmentUrl: null, lastMessageAttachmentType: null,
    otherUserId: null, otherUsername: null, otherAvatar: null,
    hasMention: false, unreadCount: 7,
    ...over,
  });
  const run = async (r: Record<string, unknown>) => {
    const repo = { getSidebarRooms: vi.fn().mockResolvedValue([row(r)]) } as any;
    return (await new GetSidebarDataUseCase(repo).execute("u1")).channels[0];
  };

  it("passes the count through for an unread room (string from some drivers)", async () => {
    expect((await run({ unreadCount: "7" })).unreadCount).toBe(7);
  });

  it("is 0 when the latest message is the user's own", async () => {
    expect((await run({ lastMessageUserId: "u1" })).unreadCount).toBe(0);
  });

  it("is at least 1 whenever the room is unread", async () => {
    expect((await run({ unreadCount: 0 })).unreadCount).toBe(1);
  });
});

describe("ToggleReactionUseCase", () => {
  it("bumps the message so delta sync sees reaction changes", async () => {
    const messages = { getRoomIdByMessageId: vi.fn().mockResolvedValue("r1"), touchMessage: vi.fn() } as any;
    const reactions = { toggleReaction: vi.fn().mockResolvedValue({ action: "removed", reaction: null }) } as any;
    await new ToggleReactionUseCase(reactions, messages, pusher()).execute("u1", "m1", "👍");
    expect(messages.touchMessage).toHaveBeenCalledWith("m1");
  });
});
