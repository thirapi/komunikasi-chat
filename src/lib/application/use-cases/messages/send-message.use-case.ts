import { roomChannel } from "@/lib/pusher/channels";
import type { IUserBlockRepository } from "../../repositories/user-block.repository.interface";
import type { NewPoll } from "../../repositories/message.repository.interface";
import { BlockError, BLOCKED_DM_MESSAGE } from "../users/block-user.use-case";
import { MessageWithUserDTO } from "../../../entities/models/message.model";
import { IMessageRepository } from "../../repositories/message.repository.interface";
import { IRoomRepository } from "../../repositories/room.repository.interface";
import { INotifierService } from "../../services/discord-notifier.service.interface";
import { IPusherService } from "../../services/pusher.service.interface";
import { IPushSubscriptionRepository } from "../../repositories/push-subscription.repository.interface";
import { IWebPushService } from "../../services/web-push.service.interface";
import { IIdempotencyStore } from "../../services/idempotency.service.interface";

const IDEMPOTENCY_TTL = 10 * 60; // seconds; covers any realistic retry window

export class SendMessageUseCase {
  constructor(
    private messageRepository: IMessageRepository,
    private roomRepository: IRoomRepository,
    private pusherService: IPusherService,
    private discordNotifierService: INotifierService,
    private pushSubscriptionRepository: IPushSubscriptionRepository,
    private webPushService: IWebPushService,
    private idempotencyStore?: IIdempotencyStore,
    private blockRepository?: Pick<IUserBlockRepository, "getStatus">,
  ) { }

  /** A DM closed by a block (either way) takes no new messages. */
  private async assertNotBlocked(userId: string, roomId: string) {
    if (!this.blockRepository) return;
    const access = await this.roomRepository.getRoomAccess(roomId, userId);
    if (!access.isDirect) return;
    const [other] = await this.roomRepository.getOtherParticipants(roomId, userId);
    if (!other) return;
    const status = await this.blockRepository.getStatus(userId, other.userId);
    if (status.iBlocked || status.blockedMe) throw new BlockError(BLOCKED_DM_MESSAGE);
  }

  async execute(
    userId: string,
    content: string,
    roomId: string,
    replyTo?: string,
    attachments?: { url: string; key: string; fileType: string; size?: number }[],
    optimisticId?: string,
    options?: { isForwarded?: boolean; poll?: NewPoll }
  ): Promise<MessageWithUserDTO> {
    await this.assertNotBlocked(userId, roomId);

    // A retry of the same optimistic send (the first response was lost, or the
    // user pressed "Coba lagi") returns the already-created message instead of
    // posting a duplicate. Best effort: if the store is unreachable we send.
    const idemKey = optimisticId ? `send:${userId}:${optimisticId}` : null;
    let claimed = false;
    if (idemKey && this.idempotencyStore) {
      try {
        const existing = await this.idempotencyStore.claim(idemKey, IDEMPOTENCY_TTL);
        if (existing === null) {
          claimed = true;
        } else if (existing !== "__pending__") {
          const previous = await this.messageRepository.getMessageById(existing);
          if (previous) return { ...previous, optimisticId };
        } else {
          throw new Error("Pesan ini sedang dikirim");
        }
      } catch (err) {
        if (err instanceof Error && err.message === "Pesan ini sedang dikirim") throw err;
        console.error("[send-message] idempotency store unavailable:", err);
      }
    }

    let message: MessageWithUserDTO;
    try {
      message = await this.messageRepository.createMessage(
        userId,
        content,
        roomId,
        replyTo,
        attachments,
        options
      );
    } catch (err) {
      if (claimed && idemKey) await this.idempotencyStore?.release(idemKey).catch(() => {});
      throw err;
    }
    if (claimed && idemKey) {
      await this.idempotencyStore?.complete(idemKey, message.id, IDEMPOTENCY_TTL).catch(() => {});
    }

    const messageWithOptimisticId = { ...message, optimisticId };

    await this.pusherService.trigger(roomChannel(roomId), "new-message", messageWithOptimisticId);

    const [roomData, participants] = await Promise.all([
      this.roomRepository.getRoomById(roomId),
      this.roomRepository.getOtherParticipants(roomId, userId),
    ]);
    const userName = message.user.username;

    const receiverIds = participants.map((p) => p.userId);

    // A new message brings an archived chat back, unless it is muted.
    const nowMs = Date.now();
    const toUnarchive = participants
      .filter((p) => p.archivedAt && !(p.mutedUntil && new Date(p.mutedUntil).getTime() > nowMs))
      .map((p) => p.userId);
    if (toUnarchive.length > 0) {
      await this.roomRepository.setArchived(toUnarchive, roomId, null).catch((err) => {
        console.error("[send-message] unarchive failed:", err);
      });
    }

    await this.pusherService.triggerToUsers(
      receiverIds,
      "new-message-notification",
      {
        message: messageWithOptimisticId,
        senderId: userId,
        room: roomData
          ? { name: roomData.name, isDirect: roomData.isDirect }
          : null,
      }
    );

    const resolveContentForNotification = (raw: string) => {
      return raw.replace(/<@([a-zA-Z0-9_-]+)>/g, (match, uid) => {
        if (uid === "everyone") return "@everyone";
        if (uid === userId) return `@${userName}`;
        const p = participants.find(p => p.userId === uid);
        // We assume p.user.username exists on the returned participants
        return p && (p as any).user?.username ? `@${(p as any).user.username}` : match;
      });
    };

    const notificationContent = resolveContentForNotification(content);

    // Push notifications for offline/background users, asynchronously.
    // One batched query for all receivers instead of a serial round-trip per
    // room member on the critical send path.
    //
    // Each subscription carries its own transport: "web" rows go over VAPID,
    // "fcm" rows over Firebase Cloud Messaging. Both are kept because FCM is
    // delivered by Google Play Services and simply cannot reach devices
    // without it, which is common on Huawei and degoogled ROMs.
    const pushPromises: Promise<void>[] = [];

    // The message is already stored and broadcast at this point. Push and the
    // Discord webhook are side channels: if either fails (schema drift, network)
    // the send must still succeed, or the sender sees an error for a message
    // everyone else already received.
    let allSubscriptions: Awaited<
      ReturnType<typeof this.pushSubscriptionRepository.getSubscriptionsByUserIds>
    > = [];
    // Muted rooms get no push, except for messages that mention the
    // receiver (or @everyone), like WhatsApp, Telegram and Teams. The realtime
    // notification above still goes out so unread counts stay right.
    const now = Date.now();
    const mentionsEveryone = content.includes("<@everyone>");
    const pushReceiverIds = participants
      .filter((p) => {
        const muted = p.mutedUntil ? new Date(p.mutedUntil).getTime() > now : false;
        return !muted || mentionsEveryone || content.includes(`<@${p.userId}>`);
      })
      .map((p) => p.userId);

    try {
      allSubscriptions = await this.pushSubscriptionRepository.getSubscriptionsByUserIds(pushReceiverIds);
    } catch (err) {
      console.error("[send-message] Failed to load push subscriptions:", err);
    }

    for (const sub of allSubscriptions) {
      if (sub.type === "fcm") {
        pushPromises.push(
          this.webPushService
            .sendNativeNotification(sub.endpoint, {
              title: userName,
              body: notificationContent,
              url: `/channels/${roomId}`,
            })
            .then(async ({ expired }) => {
              // A rejected token never recovers; drop it so the row does not
              // grow without bound and every send does not retry a dead target.
              if (expired) {
                await this.pushSubscriptionRepository
                  .deleteSubscriptionById(sub.id)
                  .catch(() => {});
              }
            })
        );
        continue;
      }

      if (!sub.p256dh || !sub.auth) continue;

      pushPromises.push(
        this.webPushService.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title: userName,
            body: notificationContent,
            url: `/channels/${roomId}`,
          })
        )
      );
    }

    Promise.allSettled(pushPromises).catch(console.error);

    try {
      await this.discordNotifierService.sendMessage(
        [
          `@everyone`,
          `**Pesan Baru**`,
          `Pengirim: **${userName ?? userId}**`,
          `Ruangan: **${roomData?.name ?? roomId}**`,
          `Konten:\n> ${notificationContent}`,
        ].join("\n")
      );
    } catch (err) {
      console.error("[send-message] Discord notifier failed:", err);
    }

    return messageWithOptimisticId;
  }
}
