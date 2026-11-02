import { SidebarRoomDTO } from "@/lib/entities/models/room.model";
import { IRoomRepository } from "../../repositories/room.repository.interface";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];

const MENTION_TOKEN = /<@([a-zA-Z0-9_-]+)>/g;

export class GetSidebarDataUseCase {
  constructor(private roomRepository: IRoomRepository) { }

  async execute(userId: string): Promise<{
    channels: SidebarRoomDTO[];
    directMessages: SidebarRoomDTO[];
  }> {
    const rows = (await this.roomRepository.getSidebarRooms(userId)) ?? [];

    const formattedRooms: SidebarRoomDTO[] = rows.map((row) => {
      const lastReadTime = row.lastReadAt ? new Date(row.lastReadAt).getTime() : 0;
      const lastMessageTime = row.lastMessageCreatedAt
        ? new Date(row.lastMessageCreatedAt).getTime()
        : 0;

      // A room has unread if there is at least one message, the latest message
      // is not from the current user, and it is newer than lastReadAt.
      const hasUnread = Boolean(
        row.lastMessageId &&
          row.lastMessageUserId !== userId &&
          lastMessageTime > lastReadTime,
      );

      // Mention presence over the unread range is resolved in SQL, so only the
      // display text still needs work here.
      const hasMention = Boolean(row.hasMention);
      // Same range as hasUnread; at least 1 whenever the room is unread, 0
      // when the latest message is the user's own.
      const unreadCount = hasUnread ? Math.max(1, Number(row.unreadCount ?? 0) || 0) : 0;

      let lastMessageDisplay: string | undefined = row.lastMessageContent ?? undefined;
      if (lastMessageDisplay) {
        // Mentions are stored as <@userId>; DMs render the other participant's
        // username, anything unresolved is left as the raw token.
        lastMessageDisplay = lastMessageDisplay.replace(
          MENTION_TOKEN,
          (match, uid: string) => {
            if (uid === "everyone") return "@everyone";
            if (row.isDirect) {
              return row.otherUserId === uid && row.otherUsername
                ? `@${row.otherUsername}`
                : match;
            }
            return match;
          },
        );
      }

      if (
        row.lastMessageId &&
        !row.lastMessageContent &&
        row.lastMessageAttachmentUrl
      ) {
        const url = row.lastMessageAttachmentUrl.toLowerCase();
        const isImage =
          IMAGE_EXTENSIONS.some((ext) => url.includes(ext)) ||
          row.lastMessageAttachmentType?.startsWith("image/");
        lastMessageDisplay = isImage ? "📷 Foto" : "📁 File";
      }

      if (row.isDirect) {
        return {
          id: row.roomId,
          userId: row.otherUserId || userId,
          name: row.otherUsername || "unknown",
          avatar: row.otherAvatar || "/avatars/avatar1.png",
          url: `/channels/${row.roomId}`,
          hasUnread,
          hasMention,
          unreadCount,
          mutedUntil: row.mutedUntil ? new Date(row.mutedUntil) : null,
          type: "direct" as const,
          lastMessage: lastMessageDisplay,
          lastMessageTime: row.lastMessageCreatedAt ?? undefined,
        };
      }

      return {
        id: row.roomId,
        name: row.roomName,
        url: `/channels/${row.roomId}`,
        avatar: row.roomAvatar,
        hasUnread,
        hasMention,
        unreadCount,
        mutedUntil: row.mutedUntil ? new Date(row.mutedUntil) : null,
        type: "channel" as const,
        lastMessage: lastMessageDisplay,
        lastMessageTime: row.lastMessageCreatedAt ?? undefined,
      };
    });

    return {
      channels: formattedRooms.filter((r) => r.type === "channel"),
      directMessages: formattedRooms.filter((r) => r.type === "direct"),
    };
  }
}
