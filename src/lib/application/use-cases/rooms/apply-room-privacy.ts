import { LastSeenLabel, RoomWithParticipantsDTO } from "@/lib/entities/models/room.model";
import { BlockStatus } from "@/lib/entities/models/block.model";

const DAY = 24 * 60 * 60 * 1000;

export function lastSeenLabel(at: Date | string | null | undefined, now = Date.now()): LastSeenLabel | null {
  if (!at) return null;
  const age = now - new Date(at).getTime();
  if (age <= 3 * DAY) return "recently";
  if (age <= 7 * DAY) return "week";
  if (age <= 30 * DAY) return "month";
  return "long";
}

/**
 * What one viewer may see of the other members' read positions and last
 * seen. Both settings are reciprocal (WhatsApp and Telegram): turn read
 * receipts or last seen off and you stop seeing other people's too.
 * - read positions (✓✓): only when both have read receipts on;
 * - last seen: exact when both show it, otherwise a rough label (Telegram's
 *   "recently / this week / this month"); nothing at all between two people
 *   who blocked each other;
 * - other people's privacy flags are not sent.
 */
export function applyRoomPrivacy(
  room: RoomWithParticipantsDTO,
  viewerId: string | null,
  blockedWith: (userId: string) => boolean,
  now = Date.now(),
): RoomWithParticipantsDTO {
  const viewer = viewerId ? room.participants.find((p) => p.user.id === viewerId) : undefined;
  const viewerReceipts = viewer?.user.readReceipts ?? false;
  const viewerShowsLastSeen = viewer?.user.showLastSeen ?? false;

  return {
    ...room,
    participants: room.participants.map((p) => {
      if (viewer && p.user.id === viewer.user.id) return p;
      const receipts = viewerReceipts && p.user.readReceipts !== false;
      const blocked = blockedWith(p.user.id);
      const exact = !blocked && viewerShowsLastSeen && p.user.showLastSeen !== false;
      const { showLastSeen: _s, readReceipts: _r, lastSeenAt, ...user } = p.user;
      return {
        ...p,
        lastReadAt: receipts ? p.lastReadAt : null,
        lastReadMessageId: receipts ? p.lastReadMessageId : null,
        user: {
          ...user,
          lastSeenAt: exact ? lastSeenAt ?? null : null,
          lastSeenLabel: blocked || exact ? null : lastSeenLabel(lastSeenAt, now),
        },
      };
    }),
  };
}

/**
 * For endpoints that list or create rooms (sidebar-style data, start a DM,
 * explore channels): nobody needs other members' read positions there, so
 * they are removed outright instead of applying the full per-viewer rules.
 */
export function withoutOthersReadPositions<T extends RoomWithParticipantsDTO>(room: T, viewerId: string | null): T {
  return {
    ...room,
    participants: room.participants.map((p) =>
      p.user.id === viewerId ? p : { ...p, lastReadAt: null, lastReadMessageId: null },
    ),
  };
}

export type { BlockStatus };
