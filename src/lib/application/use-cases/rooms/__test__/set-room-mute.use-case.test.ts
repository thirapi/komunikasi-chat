import { describe, it, expect, vi } from "vitest";
import { SetRoomMuteUseCase, MUTE_FOREVER } from "../set-room-mute.use-case";

describe("SetRoomMuteUseCase", () => {
  it("maps durations to an end time", () => {
    const now = Date.UTC(2026, 10, 2, 10, 0, 0);
    expect(SetRoomMuteUseCase.until("1h", now)?.getTime()).toBe(now + 3600_000);
    expect(SetRoomMuteUseCase.until("8h", now)?.getTime()).toBe(now + 8 * 3600_000);
    expect(SetRoomMuteUseCase.until("1w", now)?.getTime()).toBe(now + 7 * 24 * 3600_000);
    expect(SetRoomMuteUseCase.until("forever", now)).toEqual(MUTE_FOREVER);
    expect(SetRoomMuteUseCase.until("off", now)).toBeNull();
  });

  it("stores the mute and tells the user's other devices", async () => {
    const repo = { setMutedUntil: vi.fn() };
    const pusher = { triggerToUsers: vi.fn() };
    const until = await new SetRoomMuteUseCase(repo, pusher).execute("u1", "r1", "forever");
    expect(repo.setMutedUntil).toHaveBeenCalledWith("u1", "r1", MUTE_FOREVER);
    expect(pusher.triggerToUsers).toHaveBeenCalledWith(["u1"], "room-mute-changed", { roomId: "r1", mutedUntil: until });
  });
});
