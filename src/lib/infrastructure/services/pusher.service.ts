// src/lib/infrastructure/services/pusher.service.ts
import { userChannel } from "@/lib/pusher/channels";
import Pusher from "pusher";
import { IPusherService } from "@/lib/application/services/pusher.service.interface";

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID as string,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY as string,
  secret: process.env.PUSHER_SECRET as string,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER as string,
  useTLS: true,
});

export class PusherService implements IPusherService {
  async trigger(channel: string, event: string, data: any): Promise<void> {
    await pusher.trigger(channel, event, data);
  }

  async authenticatePresence(
    socketId: string,
    channelName: string,
    user: { id: string; username: string }
  ): Promise<any> {
    return pusher.authorizeChannel(socketId, channelName, {
      user_id: user.id,
      user_info: {
        username: user.username,
      },
    });
  }

  async authorizePrivate(socketId: string, channelName: string): Promise<any> {
    return pusher.authorizeChannel(socketId, channelName);
  }

  async triggerToUsers(userIds: string[], event: string, data: any) {
    await Promise.all(
      userIds.map((id) => pusher.trigger(userChannel(id), event, data))
    );
  }
}
