import { getUserSession } from "@/app/auth.action";
import { getImpersonatedUserId } from "@/lib/impersonate.guard";
import { getRoomAccess } from "@/lib/auth/actor";
import { joinRoomController } from "@/lib/interface-adapters/controllers/rooms/join-room.controller";
import { redirect } from "next/navigation";

/**
 * Invite link: /join/<roomId>. Holding the link is what grants access, so this
 * runs entirely on the server (no public server action) and works for private
 * channels too. Direct messages can never be joined this way.
 */
export default async function JoinRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const session = await getUserSession();
  const userId = session?.user?.id;

  if (!userId) {
    redirect(`/?callbackUrl=/join/${roomId}`);
  }

  const access = await getRoomAccess(roomId, userId);
  if (!access.exists || access.isDirect) {
    redirect("/channels/default");
  }

  if (!access.isMember && !(await getImpersonatedUserId())) {
    await joinRoomController(roomId, userId);
  }

  redirect(`/channels/${roomId}`);
}
