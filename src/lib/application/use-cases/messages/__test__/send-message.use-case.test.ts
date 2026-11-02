import { describe, it, expect, vi, beforeEach } from "vitest"
import { SendMessageUseCase } from "../send-message.use-case"
import type { IMessageRepository } from "@/lib/application/repositories/message.repository.interface"
import type { IPusherService } from "@/lib/application/services/pusher.service.interface"
import type { IRoomRepository } from "@/lib/application/repositories/room.repository.interface"
import type { INotifierService } from "@/lib/application/services/discord-notifier.service.interface"
import { MessageRecord } from "@/lib/entities/models/message.model"

describe("SendMessageUseCase", () => {
  const baseMessage: MessageRecord = {
    id: "msg1",
    userId: "user1",
    roomId: "room1",
    content: "Hello",
    attachments: [],
    replyTo: null,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockRepo = {
    createMessage: vi.fn(),
  } as unknown as IMessageRepository

  const mockRoomRepo = {
    getRoomById: vi.fn().mockResolvedValue({ name: "General" }),
    getOtherParticipants: vi.fn().mockResolvedValue([]),
  } as unknown as IRoomRepository

  const mockPusher = {
    trigger: vi.fn(),
    triggerToUsers: vi.fn(),
  } as unknown as IPusherService

  const mockNotifier = {
    sendMessage: vi.fn(),
  } as unknown as INotifierService

  const mockPushRepo = {
    saveWebSubscription: vi.fn(),
    saveFcmToken: vi.fn(),
    getSubscriptionsByUserId: vi.fn().mockResolvedValue([]),
    getSubscriptionsByUserIds: vi.fn().mockResolvedValue([]),
    deleteSubscriptionById: vi.fn(),
    deleteSubscription: vi.fn(),
  } as unknown as any

  const mockWebPushService = {
    sendNotification: vi.fn(),
    sendNativeNotification: vi.fn().mockResolvedValue({ ok: true, expired: false }),
  } as unknown as any

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(mockRoomRepo.getRoomById).mockResolvedValue({
      name: "General",
      createdAt: new Date(),
      updatedAt: new Date(),
      participants: [],
      messages: [],
      id: "",
      isDirect: false,
      description: null,
      avatar: "",
      isPublic: false,
      ownerId: null
    })
    vi.mocked(mockRoomRepo.getOtherParticipants).mockResolvedValue([])
    vi.mocked(mockPusher.trigger).mockResolvedValue(undefined as any)
    vi.mocked(mockPushRepo.getSubscriptionsByUserIds).mockResolvedValue([])
    vi.mocked(mockPushRepo.deleteSubscriptionById).mockResolvedValue(undefined)
    vi.mocked(mockWebPushService.sendNativeNotification).mockResolvedValue({ ok: true, expired: false })
  })

  const createUseCase = () => new SendMessageUseCase(mockRepo, mockRoomRepo, mockPusher, mockNotifier, mockPushRepo, mockWebPushService)

  it("should create a message and trigger pusher", async () => {
    const mockMessage = { ...baseMessage, user: { username: "user1" } }
    vi.mocked(mockRepo.createMessage).mockResolvedValue(mockMessage)

    const useCase = createUseCase()
    const result = await useCase.execute("user1", "Hello", "room1")

    expect(mockRepo.createMessage).toHaveBeenCalledWith("user1", "Hello", "room1", undefined, undefined)
    expect(mockPusher.trigger).toHaveBeenCalledWith("private-chat-room1", "new-message", mockMessage)
    expect(result).toEqual(mockMessage)
  })

  it("should handle message with attachments and replyTo", async () => {
    const attachments = [{ id: "att1", url: "https://example.com/image.jpg", key: "image.jpg", fileType: "image/jpeg", size: 1234, createdAt: new Date(), updatedAt: new Date() }]
    const mockMessage = {
      ...baseMessage,
      user: { username: "user1" },
      attachments,
      replyTo: "reply123",
    }
    vi.mocked(mockRepo.createMessage).mockResolvedValue(mockMessage)

    const useCase = createUseCase()

    const result = await useCase.execute(
      "user1",
      "Hello with image",
      "room1",
      "reply123",
      attachments
    )

    expect(mockRepo.createMessage).toHaveBeenCalledWith("user1", "Hello with image", "room1", "reply123", attachments)
    expect(mockPusher.trigger).toHaveBeenCalledWith("private-chat-room1", "new-message", mockMessage)
    expect(result).toEqual(mockMessage)
  })

  it("should throw error if messageRepository.createMessage fails", async () => {
    vi.mocked(mockRepo.createMessage).mockRejectedValue(new Error("DB error"))

    const useCase = createUseCase()

    await expect(
      useCase.execute("user1", "fail test", "room1")
    ).rejects.toThrow("DB error")

    expect(mockRepo.createMessage).toHaveBeenCalled()
    expect(mockPusher.trigger).not.toHaveBeenCalled()
  })

  it("should throw error if pusherService.trigger fails", async () => {
    const mockMessage = { ...baseMessage, user: { username: "user1" } }
    vi.mocked(mockRepo.createMessage).mockResolvedValue(mockMessage)
    vi.mocked(mockPusher.trigger).mockRejectedValue(new Error("Pusher error"))

    const useCase = createUseCase()

    await expect(
      useCase.execute("user1", "trigger fail", "room1")
    ).rejects.toThrow("Pusher error")

    expect(mockRepo.createMessage).toHaveBeenCalled()
    expect(mockPusher.trigger).toHaveBeenCalled()
  })

  it("should handle video attachments correctly", async () => {
    const videoAttachments = [{
      id: "vid1",
      url: "https://example.com/video.mp4",
      key: "video.mp4",
      fileType: "video/mp4",
      size: 50 * 1024 * 1024,
      createdAt: new Date(),
      updatedAt: new Date()
    }]
    const mockMessage = {
      ...baseMessage,
      user: { username: "user1" },
      attachments: videoAttachments,
    }
    vi.mocked(mockRepo.createMessage).mockResolvedValue(mockMessage)

    const useCase = createUseCase()

    const result = await useCase.execute(
      "user1",
      "Check out this video",
      "room1",
      undefined,
      videoAttachments
    )

    expect(mockRepo.createMessage).toHaveBeenCalledWith("user1", "Check out this video", "room1", undefined, videoAttachments)
    expect(mockPusher.trigger).toHaveBeenCalledWith("private-chat-room1", "new-message", mockMessage)
    expect(result.attachments?.[0].fileType).toBe("video/mp4")
    expect(result).toEqual(mockMessage)
  })

  it("should pass through optimisticId if provided", async () => {
    const mockMessage = { ...baseMessage, user: { username: "user1" } }
    vi.mocked(mockRepo.createMessage).mockResolvedValue(mockMessage)
    const optimisticId = "opt-123"

    const useCase = createUseCase()
    const result = await useCase.execute("user1", "Hello", "room1", undefined, undefined, optimisticId)

    const expectedMessage = { ...mockMessage, optimisticId }
    expect(mockPusher.trigger).toHaveBeenCalledWith("private-chat-room1", "new-message", expectedMessage)
    expect(result.optimisticId).toBe(optimisticId)
  })

  // FCM (native) and VAPID (web) are different transports stored side by side.
  // Both must be delivered, and each row must be routed by its own type.
  describe("push transport routing", () => {
    const mockMessage = { ...baseMessage, user: { username: "user1" } }

    beforeEach(() => {
      vi.mocked(mockRepo.createMessage).mockResolvedValue(mockMessage as any)
    })

    it("routes a web row to VAPID and an fcm row to FCM", async () => {
      vi.mocked(mockPushRepo.getSubscriptionsByUserIds).mockResolvedValue([
        { id: "w1", type: "web", endpoint: "https://push.example/1", p256dh: "k1", auth: "a1" },
        { id: "f1", type: "fcm", endpoint: "fcm-token-xyz", p256dh: null, auth: null },
      ] as any)

      await createUseCase().execute("user1", "hi", "room1")

      expect(mockWebPushService.sendNotification).toHaveBeenCalledTimes(1)
      expect(mockWebPushService.sendNotification).toHaveBeenCalledWith(
        { endpoint: "https://push.example/1", keys: { p256dh: "k1", auth: "a1" } },
        expect.stringContaining("user1"),
      )
      expect(mockWebPushService.sendNativeNotification).toHaveBeenCalledTimes(1)
      expect(mockWebPushService.sendNativeNotification).toHaveBeenCalledWith(
        "fcm-token-xyz",
        expect.objectContaining({ title: "user1", url: "/channels/room1" }),
      )
    })

    it("never sends an fcm row over VAPID", async () => {
      vi.mocked(mockPushRepo.getSubscriptionsByUserIds).mockResolvedValue([
        { id: "f1", type: "fcm", endpoint: "fcm-token-xyz", p256dh: null, auth: null },
      ] as any)

      await createUseCase().execute("user1", "hi", "room1")

      expect(mockWebPushService.sendNotification).not.toHaveBeenCalled()
    })

    it("skips a web row with missing keys rather than sending garbage", async () => {
      vi.mocked(mockPushRepo.getSubscriptionsByUserIds).mockResolvedValue([
        { id: "w1", type: "web", endpoint: "https://push.example/1", p256dh: null, auth: null },
      ] as any)

      await createUseCase().execute("user1", "hi", "room1")

      expect(mockWebPushService.sendNotification).not.toHaveBeenCalled()
    })

    it("treats a legacy row with no type as web", async () => {
      vi.mocked(mockPushRepo.getSubscriptionsByUserIds).mockResolvedValue([
        { id: "w1", endpoint: "https://push.example/1", p256dh: "k1", auth: "a1" },
      ] as any)

      await createUseCase().execute("user1", "hi", "room1")

      expect(mockWebPushService.sendNotification).toHaveBeenCalledTimes(1)
    })

    it("deletes a token FCM reports as expired", async () => {
      vi.mocked(mockPushRepo.getSubscriptionsByUserIds).mockResolvedValue([
        { id: "f1", type: "fcm", endpoint: "dead-token", p256dh: null, auth: null },
      ] as any)
      vi.mocked(mockWebPushService.sendNativeNotification).mockResolvedValue({
        ok: false,
        expired: true,
      })

      await createUseCase().execute("user1", "hi", "room1")
      await new Promise((r) => setImmediate(r))

      expect(mockPushRepo.deleteSubscriptionById).toHaveBeenCalledWith("f1")
    })

    it("keeps a token that only failed transiently", async () => {
      vi.mocked(mockPushRepo.getSubscriptionsByUserIds).mockResolvedValue([
        { id: "f1", type: "fcm", endpoint: "good-token", p256dh: null, auth: null },
      ] as any)
      vi.mocked(mockWebPushService.sendNativeNotification).mockResolvedValue({
        ok: false,
        expired: false,
      })

      await createUseCase().execute("user1", "hi", "room1")
      await new Promise((r) => setImmediate(r))

      expect(mockPushRepo.deleteSubscriptionById).not.toHaveBeenCalled()
    })
  })

  describe("idempotent retries", () => {
    const makeStore = () => ({
      claim: vi.fn(),
      complete: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
    })

    it("creates once and records the message id for the optimisticId", async () => {
      const store = makeStore()
      store.claim.mockResolvedValue(null)
      const mockMessage = { ...baseMessage, user: { username: "user1" } }
      vi.mocked(mockRepo.createMessage).mockResolvedValue(mockMessage)

      const useCase = new SendMessageUseCase(mockRepo, mockRoomRepo, mockPusher, mockNotifier, mockPushRepo, mockWebPushService, store)
      await useCase.execute("user1", "Hello", "room1", undefined, undefined, "opt-1")

      expect(store.claim).toHaveBeenCalledWith("send:user1:opt-1", expect.any(Number))
      expect(store.complete).toHaveBeenCalledWith("send:user1:opt-1", "msg1", expect.any(Number))
    })

    it("returns the existing message on retry instead of creating a duplicate", async () => {
      const store = makeStore()
      store.claim.mockResolvedValue("msg1")
      const existing = { ...baseMessage, user: { username: "user1" } }
      ;(mockRepo as any).getMessageById = vi.fn().mockResolvedValue(existing)

      const useCase = new SendMessageUseCase(mockRepo, mockRoomRepo, mockPusher, mockNotifier, mockPushRepo, mockWebPushService, store)
      const result = await useCase.execute("user1", "Hello", "room1", undefined, undefined, "opt-1")

      expect(mockRepo.createMessage).not.toHaveBeenCalled()
      expect(mockPusher.trigger).not.toHaveBeenCalled()
      expect(result).toEqual({ ...existing, optimisticId: "opt-1" })
    })

    it("releases the claim when creating fails, so the user can retry", async () => {
      const store = makeStore()
      store.claim.mockResolvedValue(null)
      vi.mocked(mockRepo.createMessage).mockRejectedValue(new Error("db down"))

      const useCase = new SendMessageUseCase(mockRepo, mockRoomRepo, mockPusher, mockNotifier, mockPushRepo, mockWebPushService, store)
      await expect(useCase.execute("user1", "Hello", "room1", undefined, undefined, "opt-1")).rejects.toThrow("db down")
      expect(store.release).toHaveBeenCalledWith("send:user1:opt-1")
    })

    it("still sends when the store is unreachable", async () => {
      const store = makeStore()
      store.claim.mockRejectedValue(new Error("redis down"))
      const mockMessage = { ...baseMessage, user: { username: "user1" } }
      vi.mocked(mockRepo.createMessage).mockResolvedValue(mockMessage)
      vi.spyOn(console, "error").mockImplementation(() => {})

      const useCase = new SendMessageUseCase(mockRepo, mockRoomRepo, mockPusher, mockNotifier, mockPushRepo, mockWebPushService, store)
      await expect(useCase.execute("user1", "Hello", "room1", undefined, undefined, "opt-1")).resolves.toEqual({ ...mockMessage, optimisticId: "opt-1" })
    })
  })

  describe("muted rooms", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000)
    const past = new Date(Date.now() - 1000)

    const run = async (content: string) => {
      vi.mocked(mockRepo.createMessage).mockResolvedValue({ ...baseMessage, content, user: { username: "user1" } } as any)
      vi.mocked(mockRoomRepo.getOtherParticipants).mockResolvedValue([
        { userId: "muted", mutedUntil: future },
        { userId: "expired", mutedUntil: past },
        { userId: "normal", mutedUntil: null },
      ] as any)
      await createUseCase().execute("user1", content, "room1")
    }

    it("skips push for receivers who muted the room", async () => {
      await run("halo semua")
      expect(mockPushRepo.getSubscriptionsByUserIds).toHaveBeenCalledWith(["expired", "normal"])
      // The realtime notification still reaches everyone, for unread counts.
      expect(mockPusher.triggerToUsers).toHaveBeenCalledWith(["muted", "expired", "normal"], "new-message-notification", expect.anything())
    })

    it("still pushes a mention to a muted receiver", async () => {
      await run("<@muted> cek ini")
      expect(mockPushRepo.getSubscriptionsByUserIds).toHaveBeenCalledWith(["muted", "expired", "normal"])
    })

    it("still pushes @everyone to a muted receiver", async () => {
      await run("<@everyone> rapat jam 3")
      expect(mockPushRepo.getSubscriptionsByUserIds).toHaveBeenCalledWith(["muted", "expired", "normal"])
    })
  })
})
