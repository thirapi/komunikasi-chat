import { describe, it, expect, vi, beforeEach } from "vitest";
import { authState, resetAuthState } from "./auth-test-state";
import {
  createMessage,
  editMessageAction,
  deleteMessageAction,
  searchMessagesAction,
  toggleReactionAction,
  setTypingStatusAction,
  uploadFileAction,
} from "../(with-sidebar)/channels/[roomId]/messages.action";

import { sendMessageController } from "@/lib/interface-adapters/controllers/messages/send-message.controller";
import { editMessageController } from "@/lib/interface-adapters/controllers/messages/edit-message.controller";
import { deleteMessageController } from "@/lib/interface-adapters/controllers/messages/delete-message.controller";
import { searchMessagesController } from "@/lib/interface-adapters/controllers/messages/search-messages.controller";
import { toggleReactionController } from "@/lib/interface-adapters/controllers/messages/toggle-reaction.controller";
import { startTypingController, stopTypingController } from "@/lib/interface-adapters/controllers/messages/typing.controller";
import { uploadFileController } from "@/lib/interface-adapters/controllers/storage/upload-file.controller";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/auth.action", async () => (await import("./auth-test-state")).authActionMock());
vi.mock("@/lib/impersonate.guard", async () => (await import("./auth-test-state")).impersonateMock());
vi.mock("@/lib/infrastructure/repositories/room.repository", async () => (await import("./auth-test-state")).roomRepoMock());
vi.mock("@/lib/infrastructure/repositories/message.repository", async () => (await import("./auth-test-state")).messageRepoMock());
vi.mock("@/lib/db", () => ({ db: {} }));

vi.mock("@/lib/interface-adapters/controllers/messages/send-message.controller", () => ({ sendMessageController: vi.fn() }));
vi.mock("@/lib/interface-adapters/controllers/messages/edit-message.controller", () => ({ editMessageController: vi.fn() }));
vi.mock("@/lib/interface-adapters/controllers/messages/delete-message.controller", () => ({ deleteMessageController: vi.fn() }));
vi.mock("@/lib/interface-adapters/controllers/messages/search-messages.controller", () => ({ searchMessagesController: vi.fn() }));
vi.mock("@/lib/interface-adapters/controllers/messages/toggle-reaction.controller", () => ({ toggleReactionController: vi.fn() }));
vi.mock("@/lib/interface-adapters/controllers/messages/typing.controller", () => ({
  startTypingController: vi.fn(),
  stopTypingController: vi.fn(),
}));
vi.mock("@/lib/interface-adapters/controllers/storage/upload-file.controller", () => ({ uploadFileController: vi.fn() }));

describe("messages.action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthState();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("createMessage", () => {
    it("sends a message successfully", async () => {
      const mockMsg = { id: "m1", content: "hello", room_id: "r1" } as any;
      vi.mocked(sendMessageController).mockResolvedValueOnce(mockMsg);

      const res = await createMessage("user1", "hello", "r1");
      expect(res).toEqual({ status: "success", data: mockMsg, error: null });
      expect(sendMessageController).toHaveBeenCalledWith("user1", "hello", "r1", undefined, undefined, undefined);
    });

    it("handles error during send", async () => {
      vi.mocked(sendMessageController).mockRejectedValueOnce(new Error("Send failed"));
      const res = await createMessage("user1", "hello", "r1");
      expect(res.status).toBe("error");
      expect(res.error?.message).toBe("Send failed");
    });
  });

  describe("editMessageAction", () => {
    it("edits message content", async () => {
      const mockMsg = { id: "m1", content: "edited" } as any;
      vi.mocked(editMessageController).mockResolvedValueOnce(mockMsg);

      const res = await editMessageAction("user1", "m1", "edited");
      expect(res).toEqual({ status: "success", data: mockMsg, error: null });
    });
  });

  describe("deleteMessageAction", () => {
    it("deletes a message", async () => {
      vi.mocked(deleteMessageController).mockResolvedValueOnce(undefined as any);
      const res = await deleteMessageAction("user1", "m1");
      expect(res).toEqual({ status: "success", data: null, error: null });
    });
  });

  describe("searchMessagesAction", () => {
    it("searches messages with query", async () => {
      const mockResults = [{ id: "m1", content: "test search" }] as any;
      vi.mocked(searchMessagesController).mockResolvedValueOnce(mockResults);

      const res = await searchMessagesAction("test", "r1");
      expect(res).toEqual({ status: "success", data: mockResults, error: null });
    });
  });

  describe("toggleReactionAction", () => {
    it("toggles reaction on message", async () => {
      vi.mocked(toggleReactionController).mockResolvedValueOnce({
        action: "added",
        reaction: null,
      });

      const res = await toggleReactionAction("user1", "m1", "👍");
      expect(res).toEqual({ status: "success", data: { action: "added" }, error: null });
    });
  });

  describe("setTypingStatusAction", () => {
    it("starts typing indicator when typing=true", async () => {
      vi.mocked(startTypingController).mockResolvedValueOnce(undefined as any);
      const res = await setTypingStatusAction("user1", "r1", true);
      expect(res).toEqual({ status: "success", data: null, error: null });
      expect(startTypingController).toHaveBeenCalledWith("user1", "r1");
    });

    it("stops typing indicator when typing=false", async () => {
      vi.mocked(stopTypingController).mockResolvedValueOnce(undefined as any);
      const res = await setTypingStatusAction("user1", "r1", false);
      expect(res).toEqual({ status: "success", data: null, error: null });
      expect(stopTypingController).toHaveBeenCalledWith("user1", "r1");
    });
  });

  describe("uploadFileAction", () => {
    it("returns error if no file provided in FormData", async () => {
      const formData = new FormData();
      const res = await uploadFileAction(formData);
      expect(res).toEqual({
        status: "error",
        data: null,
        error: { message: "No file provided", type: "ValidationError" },
      });
    });

    it("uploads file successfully when file present", async () => {
      const formData = new FormData();
      const file = new File(["content"], "test.png", { type: "image/png" });
      formData.append("file", file);

      const mockUpload = { fileurl: "https://example.com/test.png", filename: "test.png", size: 7, mimetype: "image/png" };
      vi.mocked(uploadFileController).mockResolvedValueOnce(mockUpload);

      const res = await uploadFileAction(formData);
      expect(res).toEqual({ status: "success", data: mockUpload, error: null });
    });
  });

  describe("authorization", () => {
    it("rejects sending as another user", async () => {
      const res = await createMessage("victim", "hi", "r1");
      expect(res.status).toBe("error");
      expect(sendMessageController).not.toHaveBeenCalled();
    });

    it("rejects sending to a room the user is not in", async () => {
      authState.access = { exists: true, isMember: false, isPublic: true, isDirect: false, ownerId: "owner1" };
      const res = await createMessage("user1", "hi", "r1");
      expect(res.status).toBe("error");
      expect(sendMessageController).not.toHaveBeenCalled();
    });

    it("rejects a reply that points at another room's message", async () => {
      authState.messageRoomId = "other-room";
      const res = await createMessage("user1", "hi", "r1", "m-from-other-room");
      expect(res.status).toBe("error");
      expect(sendMessageController).not.toHaveBeenCalled();
    });

    it("scopes global search to the viewer", async () => {
      vi.mocked(searchMessagesController).mockResolvedValueOnce([]);
      await searchMessagesAction("rahasia");
      expect(searchMessagesController).toHaveBeenCalledWith("rahasia", undefined, 20, "user1");
    });

    it("refuses to search a private room the viewer is not in", async () => {
      authState.access = { exists: true, isMember: false, isPublic: false, isDirect: false, ownerId: "owner1" };
      const res = await searchMessagesAction("rahasia", "r1");
      expect(res.status).toBe("error");
      expect(searchMessagesController).not.toHaveBeenCalled();
    });

    it("refuses reactions from non-members", async () => {
      authState.access = { exists: true, isMember: false, isPublic: true, isDirect: false, ownerId: "owner1" };
      const res = await toggleReactionAction("user1", "m1", "👍");
      expect(res.status).toBe("error");
      expect(toggleReactionController).not.toHaveBeenCalled();
    });

    it("refuses uploads to arbitrary storage folders", async () => {
      const fd = new FormData();
      fd.append("file", new File(["x"], "x.png", { type: "image/png" }));
      const res = await uploadFileAction(fd, "../../etc");
      expect(res.status).toBe("error");
      expect(uploadFileController).not.toHaveBeenCalled();
    });

    it("refuses uploads into a room the user is not in", async () => {
      authState.access = { exists: true, isMember: false, isPublic: true, isDirect: false, ownerId: "owner1" };
      const fd = new FormData();
      fd.append("file", new File(["x"], "x.png", { type: "image/png" }));
      const res = await uploadFileAction(fd, "channels/r1");
      expect(res.status).toBe("error");
      expect(uploadFileController).not.toHaveBeenCalled();
    });
  });
});
