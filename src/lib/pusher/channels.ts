/**
 * Pusher channel names, shared by server (triggers) and client (subscriptions).
 *
 * Chat and per-user channels are `private-` channels: Pusher only lets a socket
 * subscribe after /api/pusher signs the request, and that route checks room
 * membership / identity. Public channel names would let anyone holding the
 * (public) app key listen to any room or anyone's DM notifications.
 */
export const roomChannel = (roomId: string) => `private-chat-${roomId}`;
export const userChannel = (userId: string) => `private-user-${userId}`;

export type ParsedChannel =
  | { kind: "room"; id: string }
  | { kind: "user"; id: string }
  | { kind: "presence" }
  | null;

export function parseChannel(name: string): ParsedChannel {
  if (name.startsWith("presence-")) return { kind: "presence" };
  let m = /^private-chat-([A-Za-z0-9_-]+)$/.exec(name);
  if (m) return { kind: "room", id: m[1] };
  m = /^private-user-([A-Za-z0-9_-]+)$/.exec(name);
  if (m) return { kind: "user", id: m[1] };
  return null;
}
