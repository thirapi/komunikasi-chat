import { describe, it, expect, vi } from "vitest";
import { SyncRoomMessagesUseCase } from "../sync-room-messages.use-case";

function repo(overrides: Record<string, unknown> = {}) {
  return {
    getRoomChangesSince: vi.fn(),
    getMessagesByRoomId: vi.fn().mockResolvedValue([{ id: "latest" }]),
    ...overrides,
  } as any;
}

describe("SyncRoomMessagesUseCase", () => {
  it("returns the newest page in full without a cursor", async () => {
    const r = repo();
    const res = await new SyncRoomMessagesUseCase(r).execute("r1", null);
    expect(res.mode).toBe("full");
    expect(r.getMessagesByRoomId).toHaveBeenCalledWith("r1", 50);
    expect(r.getRoomChangesSince).not.toHaveBeenCalled();
  });

  it("returns only changes since the cursor", async () => {
    const since = new Date("2026-01-01T00:00:00Z");
    const r = repo({
      getRoomChangesSince: vi.fn().mockResolvedValue({ changed: [{ id: "m9" }], deletedIds: ["m3"], overflow: false }),
    });
    const res = await new SyncRoomMessagesUseCase(r).execute("r1", since);
    expect(r.getRoomChangesSince).toHaveBeenCalledWith("r1", since, 50);
    expect(res).toMatchObject({ mode: "delta", changed: [{ id: "m9" }], deletedIds: ["m3"] });
    expect(r.getMessagesByRoomId).not.toHaveBeenCalled();
  });

  it("falls back to a full page when too much changed to patch", async () => {
    const r = repo({
      getRoomChangesSince: vi.fn().mockResolvedValue({ changed: [], deletedIds: [], overflow: true }),
    });
    const res = await new SyncRoomMessagesUseCase(r).execute("r1", new Date());
    expect(res).toMatchObject({ mode: "full", messages: [{ id: "latest" }] });
  });

  it("hands back a cursor slightly in the past, never ahead of now", async () => {
    const before = Date.now();
    const res = await new SyncRoomMessagesUseCase(repo()).execute("r1", null);
    expect(res.cursor.getTime()).toBeLessThanOrEqual(before);
    expect(before - res.cursor.getTime()).toBeLessThan(15_000);
  });
});
