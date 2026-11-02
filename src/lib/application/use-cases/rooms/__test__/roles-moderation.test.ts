import { describe, it, expect, vi } from "vitest";
import { RemoveParticipantUseCase } from "../remove-participant.use-case";
import { SetParticipantRoleUseCase } from "../set-participant-role.use-case";
import { UpdateRoomUseCase } from "../update-room.use-case";
import { DeleteMessageUseCase } from "../../messages/delete-message.use-case";
import { HideMessageUseCase } from "../../messages/hide-message.use-case";
import { SyncRoomMessagesUseCase } from "../../messages/sync-room-messages.use-case";

const room = {
  id: "c1", isDirect: false, ownerId: "owner",
  participants: [
    { user: { id: "owner" }, role: "owner" },
    { user: { id: "admin" }, role: "admin" },
    { user: { id: "admin2" }, role: "admin" },
    { user: { id: "member" }, role: "member" },
    { user: { id: "member2" }, role: "member" },
  ],
} as any;
const roomRepo = (extra: Record<string, unknown> = {}) => ({
  getRoomById: vi.fn().mockResolvedValue(room),
  removeParticipant: vi.fn(),
  setParticipantRole: vi.fn(),
  updateRoom: vi.fn(),
  ...extra,
}) as any;

describe("removing members", () => {
  const remove = (requester: string, target: string) => new RemoveParticipantUseCase(roomRepo()).execute("c1", target, requester);
  it("lets owners and admins remove plain members", async () => {
    await expect(remove("owner", "member")).resolves.toBeUndefined();
    await expect(remove("admin", "member")).resolves.toBeUndefined();
    await expect(remove("owner", "admin")).resolves.toBeUndefined();
  });
  it("stops admins removing admins, anyone removing the owner, and members removing anyone", async () => {
    await expect(remove("admin", "admin2")).rejects.toThrow(/admin lain/);
    await expect(remove("admin", "owner")).rejects.toThrow(/Pemilik/);
    await expect(remove("member", "member2")).rejects.toThrow();
  });
  it("still lets anyone leave", async () => {
    await expect(remove("member", "member")).resolves.toBeUndefined();
  });
});

describe("appointing admins", () => {
  it("is for the owner only and never changes the owner", async () => {
    const pusher = { trigger: vi.fn() };
    const repo = roomRepo();
    await new SetParticipantRoleUseCase(repo, pusher).execute("owner", "c1", "member", "admin");
    expect(repo.setParticipantRole).toHaveBeenCalledWith("c1", "member", "admin");
    expect(pusher.trigger).toHaveBeenCalledWith(expect.stringContaining("c1"), "roles-changed", { userId: "member", role: "admin" });
    await expect(new SetParticipantRoleUseCase(roomRepo(), pusher).execute("admin", "c1", "member", "admin")).rejects.toThrow();
    await expect(new SetParticipantRoleUseCase(roomRepo(), pusher).execute("owner", "c1", "owner", "member")).rejects.toThrow();
  });
});

describe("editing channel info", () => {
  it("is allowed for admins, not members", async () => {
    await expect(new UpdateRoomUseCase(roomRepo()).execute("c1", "admin", { name: "x" })).resolves.toBeUndefined();
    await expect(new UpdateRoomUseCase(roomRepo()).execute("c1", "member", { name: "x" })).rejects.toThrow();
  });
});

describe("moderation: deleting someone else's message", () => {
  const setup = (role: string | null, isDirect = false) => {
    const messages = {
      getMessageById: vi.fn().mockResolvedValue({ id: "m1", userId: "author", roomId: "c1", createdAt: new Date(), attachments: [] }),
      deleteMessage: vi.fn(),
      getAttachmentUrlsInUse: vi.fn().mockResolvedValue([]),
    } as any;
    const rooms = {
      getRoomAccess: vi.fn().mockResolvedValue({ isMember: true, isDirect, role }),
      fallbackLastReadMessageId: vi.fn(),
      getOtherParticipants: vi.fn().mockResolvedValue([]),
    } as any;
    return { uc: new DeleteMessageUseCase(messages, rooms, { trigger: vi.fn(), triggerToUsers: vi.fn() } as any), messages };
  };
  it("works for channel admins and owners", async () => {
    for (const role of ["admin", "owner"]) {
      const { uc, messages } = setup(role);
      await uc.execute("mod", "m1");
      expect(messages.deleteMessage).toHaveBeenCalledWith("m1");
    }
  });
  it("is refused for members and in DMs", async () => {
    await expect(setup("member").uc.execute("x", "m1")).rejects.toThrow();
    await expect(setup("admin", true).uc.execute("x", "m1")).rejects.toThrow();
  });
});

describe("delete for me", () => {
  it("hides for the user only and tells their devices", async () => {
    const hidden = { hide: vi.fn() };
    const messages = { getMessageById: vi.fn().mockResolvedValue({ id: "m1", roomId: "c1" }) };
    const rooms = { getRoomAccess: vi.fn().mockResolvedValue({ isMember: true }) };
    const pusher = { triggerToUsers: vi.fn() };
    await new HideMessageUseCase(hidden, messages as any, rooms as any, pusher).execute("u1", "m1");
    expect(hidden.hide).toHaveBeenCalledWith("u1", "m1");
    expect(pusher.triggerToUsers).toHaveBeenCalledWith(["u1"], "message-hidden", { roomId: "c1", messageId: "m1" });
    rooms.getRoomAccess.mockResolvedValue({ isMember: false });
    await expect(new HideMessageUseCase(hidden, messages as any, rooms as any, pusher).execute("u2", "m1")).rejects.toThrow();
  });

  it("reports messages hidden on another device as removals in delta sync", async () => {
    const repo = {
      getRoomChangesSince: vi.fn().mockResolvedValue({ changed: [], deletedIds: ["d1"], overflow: false }),
      getMessagesByRoomId: vi.fn(),
    } as any;
    const hidden = { hiddenSince: vi.fn().mockResolvedValue(["h1", "d1"]) };
    const res = await new SyncRoomMessagesUseCase(repo, hidden).execute("c1", new Date(), "u1");
    expect(repo.getRoomChangesSince).toHaveBeenCalledWith("c1", expect.any(Date), 50, "u1");
    expect(res).toMatchObject({ mode: "delta", deletedIds: ["d1", "h1"] });
  });
});
