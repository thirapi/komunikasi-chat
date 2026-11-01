import { getUserSession } from "@/app/auth.action";
import { getImpersonatedUserId } from "@/lib/impersonate.guard";
import { RoomRepository } from "@/lib/infrastructure/repositories/room.repository";
import { MessageRepository } from "@/lib/infrastructure/repositories/message.repository";
import { db } from "@/lib/db";

/**
 * Server-side identity for server actions.
 *
 * Server actions are public HTTP endpoints: any argument — including a
 * `userId` — can be forged from DevTools. Every action therefore derives the
 * acting user from the session cookie here and never trusts an id sent by the
 * client. Actions keep their old `userId` parameters only so call sites do not
 * change; `requireWriter(claimed)` rejects a claim that does not match.
 */

export class AuthorizationError extends Error {
  constructor(message = "Kamu tidak punya akses untuk tindakan ini") {
    super(message);
    this.name = "AuthorizationError";
  }
}

const roomRepository = new RoomRepository(db);
const messageRepository = new MessageRepository(db);

export type Actor = {
  /** The signed-in account. */
  sessionUserId: string;
  /** Whose data is being viewed: the impersonated user for admins, else the session user. */
  userId: string;
  isImpersonating: boolean;
};

export async function getActor(): Promise<Actor> {
  const session = await getUserSession();
  const sessionUserId = session?.user?.id;
  if (!sessionUserId) throw new AuthorizationError("Sesi berakhir, silakan masuk lagi");
  const impersonated = await getImpersonatedUserId();
  return {
    sessionUserId,
    userId: impersonated ?? sessionUserId,
    isImpersonating: !!impersonated,
  };
}

/**
 * For anything that changes data. Returns the session user id. Fails during
 * impersonation (read-only by design) and when the client claims to be
 * someone else.
 */
export async function requireWriter(claimedUserId?: string | null): Promise<string> {
  const actor = await getActor();
  if (actor.isImpersonating) {
    throw new AuthorizationError("Tidak dapat melakukan aksi ini saat mode impersonasi");
  }
  if (claimedUserId && claimedUserId !== actor.sessionUserId) {
    throw new AuthorizationError();
  }
  return actor.sessionUserId;
}

/**
 * For admin-panel actions. Checks the role of the *session* account (an admin
 * keeps admin rights while viewing as someone) and returns its id. Any
 * client-supplied actor id must match it.
 */
export async function requireAdmin(claimedUserId?: string | null): Promise<string> {
  const actor = await getActor();
  if (claimedUserId && claimedUserId !== actor.sessionUserId) throw new AuthorizationError();
  const { adminGuard } = await import("@/lib/middlewares/role-guard.middleware");
  if (!(await adminGuard())) throw new AuthorizationError("Hanya admin yang dapat melakukan ini");
  return actor.sessionUserId;
}

/** For reads that also work signed-out (public profiles). Null when anonymous. */
export async function getOptionalViewer(): Promise<string | null> {
  try {
    return (await getActor()).userId;
  } catch (err) {
    if (err instanceof AuthorizationError) return null;
    throw err;
  }
}

/** For reads. Returns the user whose data should be shown. */
export async function requireReader(): Promise<string> {
  return (await getActor()).userId;
}

/** Members can read any room; non-members only public channels (preview before joining). */
export async function assertCanReadRoom(roomId: string, userId: string) {
  const access = await roomRepository.getRoomAccess(roomId, userId);
  if (!access.exists) throw new AuthorizationError("Room tidak ditemukan");
  if (!access.isMember && !(access.isPublic && !access.isDirect)) throw new AuthorizationError();
  return access;
}

/** Posting, reacting, typing, read receipts: members only. */
export async function assertRoomMember(roomId: string, userId: string) {
  const access = await roomRepository.getRoomAccess(roomId, userId);
  if (!access.exists) throw new AuthorizationError("Room tidak ditemukan");
  if (!access.isMember) throw new AuthorizationError("Kamu bukan anggota room ini");
  return access;
}

export async function assertMessageRoomMember(messageId: string, userId: string) {
  const roomId = await messageRepository.getRoomIdByMessageId(messageId);
  if (!roomId) throw new AuthorizationError("Pesan tidak ditemukan");
  await assertRoomMember(roomId, userId);
  return roomId;
}

export async function getMessageRoomId(messageId: string) {
  return messageRepository.getRoomIdByMessageId(messageId);
}

export async function getRoomAccess(roomId: string, userId: string) {
  return roomRepository.getRoomAccess(roomId, userId);
}
