import { NextRequest, NextResponse } from "next/server";
import { authorizePresenceChannelController } from "@/lib/interface-adapters/controllers/messages/authorize-presence-channel.controller";
import { getUserSessionFromRequest } from "@/app/auth.action";
import { getImpersonatedUserId } from "@/lib/impersonate.guard";
import { getRoomAccess } from "@/lib/auth/actor";
import { parseChannel } from "@/lib/pusher/channels";
import { PusherService } from "@/lib/infrastructure/services/pusher.service";

const pusherService = new PusherService();

/**
 * Pusher channel authorization. Signs a subscription only when the session may
 * see that channel:
 *   presence-*        any signed-in user (online list)
 *   private-user-X    only X (or an admin currently viewing as X)
 *   private-chat-R    members of R, or anyone for a public channel
 * Everything else is refused, so a client cannot get arbitrary channels signed.
 */
export async function POST(req: NextRequest) {
  try {
    const params = new URLSearchParams(await req.text());
    const socketId = params.get("socket_id");
    const channelName = params.get("channel_name");

    if (!socketId || !channelName) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const session = await getUserSessionFromRequest(req);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const viewerId = (await getImpersonatedUserId()) ?? session.user.id;

    const channel = parseChannel(channelName);
    if (!channel) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (channel.kind === "presence") {
      const response = await authorizePresenceChannelController({
        socketId,
        channelName,
        userId: session.user.id,
        username: session.user.username,
      });
      return NextResponse.json(response);
    }

    if (channel.kind === "user" && channel.id !== viewerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (channel.kind === "room") {
      const access = await getRoomAccess(channel.id, viewerId);
      const allowed = access.exists && (access.isMember || (access.isPublic && !access.isDirect));
      if (!allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json(await pusherService.authorizePrivate(socketId, channelName));
  } catch (error) {
    console.error("Pusher auth error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
