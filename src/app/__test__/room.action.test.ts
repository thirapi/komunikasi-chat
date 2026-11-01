import { describe, it, expect, vi, beforeEach } from "vitest";
import { authState, resetAuthState } from "./auth-test-state";
import {
  getSidebarData,
  getRoom,
  getRoomSnapshot,
  createRoom,
  createChannel,
  getPublicRooms,
  joinRoom,
  removeParticipant,
  updateChannel,
  deleteChannel,
  inviteToChannel,
} from "../(with-sidebar)/channels/[roomId]/room.action";

import { getSidebarDataController } from "@/lib/interface-adapters/controllers/rooms/get-sidebar-data.controller";
import { getRoomByIdController } from "@/lib/interface-adapters/controllers/rooms/get-room-by-id.controller";
import { getMessageController } from "@/lib/interface-adapters/controllers/messages/get-message.controller";
import { getLastReadAtController } from "@/lib/interface-adapters/controllers/rooms/get-last-read-at.controller";
import { startDirectMessageController } from "@/lib/interface-adapters/controllers/rooms/start-direct-message.controller";
import { createRoomController } from "@/lib/interface-adapters/controllers/rooms/create-room.controller";
import { getPublicRoomsController } from "@/lib/interface-adapters/controllers/rooms/get-public-rooms.controller";
import { joinRoomController } from "@/lib/interface-adapters/controllers/rooms/join-room.controller";
import { removeParticipantController } from "@/lib/interface-adapters/controllers/rooms/remove-participant.controller";
import { updateRoomController, deleteRoomController } from "@/lib/interface-adapters/controllers/rooms/room-settings.controller";
import { inviteToRoomController } from "@/lib/interface-adapters/controllers/rooms/invite-to-room.controller";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/auth.action", async () => (await import("./auth-test-state")).authActionMock());
vi.mock("@/lib/impersonate.guard", async () => (await import("./auth-test-state")).impersonateMock());
vi.mock("@/lib/infrastructure/repositories/room.repository", async () => (await import("./auth-test-state")).roomRepoMock());
vi.mock("@/lib/infrastructure/repositories/message.repository", async () => (await import("./auth-test-state")).messageRepoMock());
vi.mock("@/lib/db", () => ({ db: {} }));

vi.mock("@/lib/interface-adapters/controllers/rooms/get-sidebar-data.controller", () => ({ getSidebarDataController: vi.fn() }));
vi.mock("@/lib/interface-adapters/controllers/rooms/get-room-by-id.controller", () => ({ getRoomByIdController: vi.fn() }));
vi.mock("@/lib/interface-adapters/controllers/messages/get-message.controller", () => ({ getMessageController: vi.fn() }));
vi.mock("@/lib/interface-adapters/controllers/rooms/get-last-read-at.controller", () => ({ getLastReadAtController: vi.fn() }));
vi.mock("@/lib/interface-adapters/controllers/rooms/get-room-by-user-id.controller", () => ({ getRoomByUserIdController: vi.fn() }));
vi.mock("@/lib/interface-adapters/controllers/rooms/start-direct-message.controller", () => ({ startDirectMessageController: vi.fn() }));
vi.mock("@/lib/interface-adapters/controllers/rooms/create-room.controller", () => ({ createRoomController: vi.fn() }));
vi.mock("@/lib/interface-adapters/controllers/rooms/get-public-rooms.controller", () => ({ getPublicRoomsController: vi.fn() }));
vi.mock("@/lib/interface-adapters/controllers/rooms/join-room.controller", () => ({ joinRoomController: vi.fn() }));
vi.mock("@/lib/interface-adapters/controllers/rooms/remove-participant.controller", () => ({ removeParticipantController: vi.fn() }));
vi.mock("@/lib/interface-adapters/controllers/rooms/room-settings.controller", () => ({
  updateRoomController: vi.fn(),
  deleteRoomController: vi.fn(),
}));
vi.mock("@/lib/interface-adapters/controllers/rooms/invite-to-room.controller", () => ({
  searchInvitableUsersController: vi.fn(),
  inviteToRoomController: vi.fn(),
}));

describe("room.action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthState();
  });

  describe("getSidebarData", () => {
    it("returns sidebar channels and DMs on success", async () => {
      const mockData = { channels: [{ id: "c1" } as any], directMessages: [] };
      vi.mocked(getSidebarDataController).mockResolvedValueOnce(mockData);

      const res = await getSidebarData("user1");
      expect(res).toEqual({ status: "success", data: mockData, error: null });
    });
  });

  describe("getRoom", () => {
    it("returns room details by id", async () => {
      const mockRoom = { id: "r1", name: "General" } as any;
      vi.mocked(getRoomByIdController).mockResolvedValueOnce(mockRoom);

      const res = await getRoom("r1");
      expect(res).toEqual({ status: "success", data: mockRoom, error: null });
    });
  });

  describe("getRoomSnapshot", () => {
    it("returns room, newest messages and the viewer's read position in one call", async () => {
      const room = { id: "r1", name: "General" } as any;
      const messages = [{ id: "m1" }, { id: "m2" }] as any;
      const lastRead = { id: "m1", at: new Date("2026-01-01T00:00:00Z") };
      vi.mocked(getRoomByIdController).mockResolvedValueOnce(room);
      vi.mocked(getMessageController).mockResolvedValueOnce(messages);
      vi.mocked(getLastReadAtController).mockResolvedValueOnce(lastRead);

      const res = await getRoomSnapshot("r1");
      expect(res).toEqual({ status: "success", data: { room, messages, lastRead }, error: null });
      expect(getMessageController).toHaveBeenCalledWith("r1", 50);
      // Read position is always the session user's, never a client-supplied id.
      expect(getLastReadAtController).toHaveBeenCalledWith(authState.sessionUserId, "r1");
    });

    it("errors when the room does not exist", async () => {
      vi.mocked(getRoomByIdController).mockResolvedValueOnce(null as any);
      vi.mocked(getMessageController).mockResolvedValueOnce([] as any);
      vi.mocked(getLastReadAtController).mockResolvedValueOnce({ id: null, at: null });
      expect((await getRoomSnapshot("r1")).status).toBe("error");
    });

    it("does not let a non-member read a private room", async () => {
      authState.access = { exists: true, isMember: false, isPublic: false, isDirect: false, ownerId: "owner1" };
      expect((await getRoomSnapshot("r1")).status).toBe("error");
      expect(getMessageController).not.toHaveBeenCalled();
      expect(getLastReadAtController).not.toHaveBeenCalled();
    });
  });

  describe("createRoom (Direct Message)", () => {
    it("creates or returns existing DM room", async () => {
      const mockRoom = { id: "dm1", isDirect: true } as any;
      vi.mocked(startDirectMessageController).mockResolvedValueOnce({ room: mockRoom, action: "created" });

      const res = await createRoom("user1", "user2");
      expect(res).toEqual({ status: "success", data: mockRoom, error: null, meta: { action: "created" } });
    });
  });

  describe("createChannel", () => {
    it("creates a new channel", async () => {
      const mockRoom = { id: "ch1", name: "general", isDirect: false } as any;
      vi.mocked(createRoomController).mockResolvedValueOnce(mockRoom);

      const res = await createChannel("general", "user1", "desc", true);
      expect(res).toEqual({ status: "success", data: mockRoom, error: null });
      expect(createRoomController).toHaveBeenCalledWith({
        name: "general",
        isDirect: false,
        participantIds: ["user1"],
        description: "desc",
        isPublic: true,
        ownerId: "user1",
      });
    });
  });

  describe("joinRoom", () => {
    it("joins a public channel", async () => {
      authState.access = { exists: true, isMember: false, isPublic: true, isDirect: false, ownerId: "owner1" };
      vi.mocked(joinRoomController).mockResolvedValueOnce(undefined as any);
      const res = await joinRoom("r1", "user1");
      expect(res).toEqual({ status: "success", data: true, error: null });
      expect(joinRoomController).toHaveBeenCalledWith("r1", "user1");
    });

    it("refuses to join a private channel through the public endpoint", async () => {
      authState.access = { exists: true, isMember: false, isPublic: false, isDirect: false, ownerId: "owner1" };
      const res = await joinRoom("r1", "user1");
      expect(res.status).toBe("error");
      expect(joinRoomController).not.toHaveBeenCalled();
    });

    it("refuses to join a direct message", async () => {
      authState.access = { exists: true, isMember: false, isPublic: true, isDirect: true, ownerId: null };
      const res = await joinRoom("dm1", "user1");
      expect(res.status).toBe("error");
      expect(joinRoomController).not.toHaveBeenCalled();
    });
  });

  describe("updateChannel", () => {
    it("updates channel data", async () => {
      vi.mocked(updateRoomController).mockResolvedValueOnce(undefined as any);
      const res = await updateChannel("r1", "user1", { name: "new-name" });
      expect(res).toEqual({ status: "success", data: true, error: null });
    });
  });

  describe("deleteChannel", () => {
    it("deletes a channel", async () => {
      vi.mocked(deleteRoomController).mockResolvedValueOnce(undefined as any);
      const res = await deleteChannel("r1", "user1");
      expect(res).toEqual({ status: "success", data: true, error: null });
    });
  });

  describe("inviteToChannel", () => {
    it("invites user to a channel as the signed-in member", async () => {
      vi.mocked(inviteToRoomController).mockResolvedValueOnce(undefined as any);
      const res = await inviteToChannel("r1", "user1", "user2");
      expect(res).toEqual({ status: "success", data: true, error: null });
      expect(inviteToRoomController).toHaveBeenCalledWith("r1", "user1", "user2");
    });

    it("rejects a forged requester id", async () => {
      const res = await inviteToChannel("r1", "owner1", "user2");
      expect(res.status).toBe("error");
      expect(inviteToRoomController).not.toHaveBeenCalled();
    });
  });

  describe("authorization", () => {
    it("rejects every action without a session", async () => {
      authState.sessionUserId = null;
      expect((await getRoom("r1")).status).toBe("error");
      expect((await createChannel("x", "user1")).status).toBe("error");
      expect(getRoomByIdController).not.toHaveBeenCalled();
      expect(createRoomController).not.toHaveBeenCalled();
    });

    it("does not let a non-member read a private room", async () => {
      authState.access = { exists: true, isMember: false, isPublic: false, isDirect: false, ownerId: "owner1" };
      const res = await getRoom("r1");
      expect(res.status).toBe("error");
      expect(getRoomByIdController).not.toHaveBeenCalled();
    });

    it("lets a non-member preview a public channel", async () => {
      authState.access = { exists: true, isMember: false, isPublic: true, isDirect: false, ownerId: "owner1" };
      vi.mocked(getRoomByIdController).mockResolvedValueOnce({ id: "r1" } as any);
      expect((await getRoom("r1")).status).toBe("success");
    });

    it("uses the session user, not the client-supplied id, for channel updates", async () => {
      const res = await updateChannel("r1", "victim", { name: "pwned" });
      expect(res.status).toBe("error");
      expect(updateRoomController).not.toHaveBeenCalled();
    });

    it("loads the viewer's own sidebar whatever id is passed", async () => {
      vi.mocked(getSidebarDataController).mockResolvedValueOnce({ channels: [], directMessages: [] } as any);
      await getSidebarData("someone-else");
      expect(getSidebarDataController).toHaveBeenCalledWith("user1");
    });

    it("blocks writes while an admin is impersonating", async () => {
      authState.impersonatedUserId = "user9";
      const res = await createChannel("x", "user1");
      expect(res.status).toBe("error");
      expect(createRoomController).not.toHaveBeenCalled();
    });
  });
});
