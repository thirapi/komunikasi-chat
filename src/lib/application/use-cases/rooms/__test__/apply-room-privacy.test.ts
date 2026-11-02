import { describe, it, expect, vi } from "vitest";
import { applyRoomPrivacy, lastSeenLabel, withoutOthersReadPositions } from "../apply-room-privacy";
import { UpdateLastReadAtUseCase } from "../update-last-read-at.use-case";
import { UpdatePresenceUseCase } from "../../presence/update-presence.use-case";

const NOW = Date.UTC(2026, 10, 2, 12, 0, 0);
const HOUR = 3600_000;
const readAt = new Date(NOW - HOUR);
const seenAt = new Date(NOW - 2 * HOUR);

function room(me: { showLastSeen: boolean; readReceipts: boolean }, them: { showLastSeen: boolean; readReceipts: boolean }) {
  const user = (id: string, p: typeof me) => ({ id, username: id, avatar: "", createdAt: new Date(), userRoles: [], lastSeenAt: seenAt, ...p });
  return {
    id: "dm", name: "dm", isDirect: true, description: null, avatar: "", isPublic: false, ownerId: null,
    createdAt: new Date(), updatedAt: new Date(), messages: [],
    participants: [
      { lastReadAt: readAt, lastReadMessageId: "m1", user: user("me", me) },
      { lastReadAt: readAt, lastReadMessageId: "m2", user: user("them", them) },
    ],
  } as any;
}
const on = { showLastSeen: true, readReceipts: true };
const off = { showLastSeen: false, readReceipts: false };
const other = (r: any) => r.participants[1];

describe("applyRoomPrivacy", () => {
  it("shows exact last seen and read position when both allow it", () => {
    const r = other(applyRoomPrivacy(room(on, on), "me", () => false, NOW));
    expect(r.lastReadAt).toEqual(readAt);
    expect(r.user.lastSeenAt).toEqual(seenAt);
    expect(r.user.lastSeenLabel).toBeNull();
    // Their privacy flags are not sent.
    expect(r.user.showLastSeen).toBeUndefined();
    expect(r.user.readReceipts).toBeUndefined();
  });

  it("hides them when the other person turned them off", () => {
    const r = other(applyRoomPrivacy(room(on, off), "me", () => false, NOW));
    expect(r.lastReadAt).toBeNull();
    expect(r.lastReadMessageId).toBeNull();
    expect(r.user.lastSeenAt).toBeNull();
    expect(r.user.lastSeenLabel).toBe("recently");
  });

  it("is reciprocal: turning yours off hides theirs from you", () => {
    const r = other(applyRoomPrivacy(room(off, on), "me", () => false, NOW));
    expect(r.lastReadAt).toBeNull();
    expect(r.user.lastSeenAt).toBeNull();
    expect(r.user.lastSeenLabel).toBe("recently");
  });

  it("shows nothing of last seen across a block", () => {
    const r = other(applyRoomPrivacy(room(on, on), "me", (id) => id === "them", NOW));
    expect(r.user.lastSeenAt).toBeNull();
    expect(r.user.lastSeenLabel).toBeNull();
  });

  it("keeps the viewer's own entry intact", () => {
    const me = applyRoomPrivacy(room(off, on), "me", () => false, NOW).participants[0];
    expect(me.user.readReceipts).toBe(false);
    expect(me.lastReadAt).toEqual(readAt);
  });

  it("buckets rough last seen like Telegram", () => {
    const d = 24 * HOUR;
    expect(lastSeenLabel(new Date(NOW - 2 * d), NOW)).toBe("recently");
    expect(lastSeenLabel(new Date(NOW - 5 * d), NOW)).toBe("week");
    expect(lastSeenLabel(new Date(NOW - 20 * d), NOW)).toBe("month");
    expect(lastSeenLabel(new Date(NOW - 90 * d), NOW)).toBe("long");
    expect(lastSeenLabel(null, NOW)).toBeNull();
  });
});

describe("read receipts off", () => {
  it("does not broadcast read-receipt, but still syncs the user's own devices", async () => {
    const rooms = {
      getLastReadAt: vi.fn().mockResolvedValue({ id: null, at: null }),
      updateLastReadAt: vi.fn(),
      getRoomAccess: vi.fn().mockResolvedValue({ isDirect: true }),
    } as any;
    const pusher = { trigger: vi.fn(), triggerToUsers: vi.fn() } as any;
    const privacy = { getPrivacy: vi.fn().mockResolvedValue({ showLastSeen: true, readReceipts: false }) };
    await new UpdateLastReadAtUseCase(rooms, pusher, privacy).execute("u1", "dm", "m1", new Date());
    expect(pusher.triggerToUsers).toHaveBeenCalledWith(["u1"], "room-marked-read", expect.anything());
    expect(pusher.trigger).not.toHaveBeenCalled();
  });
});

describe("last seen writes", () => {
  const presence = (claim: boolean) => ({
    isUserOnline: vi.fn().mockResolvedValue(true),
    setOnline: vi.fn(),
    setOffline: vi.fn(),
    getOnlineUserIds: vi.fn(),
    claimThrottle: vi.fn().mockResolvedValue(claim),
  });

  it("writes on heartbeats only when the throttle allows it", async () => {
    const privacy = { touchLastSeen: vi.fn() };
    await new UpdatePresenceUseCase(presence(false), { trigger: vi.fn() } as any, privacy).execute("u1", "online");
    expect(privacy.touchLastSeen).not.toHaveBeenCalled();
    await new UpdatePresenceUseCase(presence(true), { trigger: vi.fn() } as any, privacy).execute("u1", "online");
    expect(privacy.touchLastSeen).toHaveBeenCalledTimes(1);
  });

  it("always writes on going offline", async () => {
    const privacy = { touchLastSeen: vi.fn() };
    await new UpdatePresenceUseCase(presence(false), { trigger: vi.fn() } as any, privacy).execute("u1", "offline");
    expect(privacy.touchLastSeen).toHaveBeenCalledTimes(1);
  });
});

describe("withoutOthersReadPositions", () => {
  it("drops everyone else's read position and keeps the viewer's", () => {
    const r = withoutOthersReadPositions(room(on, on), "me");
    expect(r.participants[0].lastReadAt).toEqual(readAt);
    expect(r.participants[1].lastReadAt).toBeNull();
    expect(r.participants[1].lastReadMessageId).toBeNull();
  });
});
