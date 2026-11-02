import { describe, it, expect, vi } from "vitest";
import { BlockUserUseCase, BLOCKED_DM_MESSAGE } from "../block-user.use-case";
import { SendMessageUseCase } from "../../messages/send-message.use-case";
import { StartDirectMessageUseCase } from "../../rooms/start-direct-message.use-case";

const status = (iBlocked: boolean, blockedMe: boolean) => ({ iBlocked, blockedMe });

describe("BlockUserUseCase", () => {
  it("blocks, tells an open DM, and returns the new status", async () => {
    const repo = { block: vi.fn(), unblock: vi.fn(), getStatus: vi.fn().mockResolvedValue(status(true, false)) };
    const rooms = { findDirectRoomBetweenUsers: vi.fn().mockResolvedValue({ id: "dm1" }) };
    const pusher = { trigger: vi.fn() };
    const res = await new BlockUserUseCase(repo, rooms, pusher).execute("u1", "u2", true);
    expect(repo.block).toHaveBeenCalledWith("u1", "u2");
    expect(pusher.trigger).toHaveBeenCalledWith(expect.stringContaining("dm1"), "block-changed", { blockerId: "u1", blockedId: "u2", blocked: true });
    expect(res).toEqual(status(true, false));
  });

  it("refuses to block yourself", async () => {
    const uc = new BlockUserUseCase({ block: vi.fn(), unblock: vi.fn(), getStatus: vi.fn() }, { findDirectRoomBetweenUsers: vi.fn() }, { trigger: vi.fn() });
    await expect(uc.execute("u1", "u1", true)).rejects.toThrow();
  });
});

describe("sending into a blocked DM", () => {
  function sendUseCase(isDirect: boolean, st: { iBlocked: boolean; blockedMe: boolean }) {
    const repo = { createMessage: vi.fn() } as any;
    const rooms = {
      getRoomAccess: vi.fn().mockResolvedValue({ exists: true, isMember: true, isPublic: false, isDirect, ownerId: null }),
      getOtherParticipants: vi.fn().mockResolvedValue([{ userId: "u2" }]),
    } as any;
    const blocks = { getStatus: vi.fn().mockResolvedValue(st) };
    const uc = new SendMessageUseCase(repo, rooms, {} as any, {} as any, {} as any, {} as any, undefined, blocks);
    return { uc, repo };
  }

  it("is refused when either side blocked", async () => {
    for (const st of [status(true, false), status(false, true)]) {
      const { uc, repo } = sendUseCase(true, st);
      await expect(uc.execute("u1", "hi", "dm1")).rejects.toThrow(BLOCKED_DM_MESSAGE);
      expect(repo.createMessage).not.toHaveBeenCalled();
    }
  });

  it("does not affect channels", async () => {
    const { uc, repo } = sendUseCase(false, status(true, true));
    repo.createMessage.mockRejectedValue(new Error("reached create"));
    await expect(uc.execute("u1", "hi", "c1")).rejects.toThrow("reached create");
  });
});

describe("starting a DM across a block", () => {
  it("opens an existing DM but refuses a new one", async () => {
    const rooms = {
      getAllRoomsByUserId: vi.fn().mockResolvedValue([]),
      createRoom: vi.fn(),
    } as any;
    const blocks = { getStatus: vi.fn().mockResolvedValue(status(false, true)) };
    await expect(new StartDirectMessageUseCase(rooms, blocks).execute("u1", "u2")).rejects.toThrow();
    expect(rooms.createRoom).not.toHaveBeenCalled();

    rooms.getAllRoomsByUserId.mockResolvedValue([{ id: "dm1", participants: [{ user: { id: "u2" } }] }]);
    const res = await new StartDirectMessageUseCase(rooms, blocks).execute("u1", "u2");
    expect(res.action).toBe("existing");
  });
});
