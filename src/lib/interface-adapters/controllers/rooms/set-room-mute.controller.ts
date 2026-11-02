import { z } from "zod";
import { db } from "@/lib/db";
import { RoomRepository } from "@/lib/infrastructure/repositories/room.repository";
import { PusherService } from "@/lib/infrastructure/services/pusher.service";
import { SetRoomMuteUseCase } from "@/lib/application/use-cases/rooms/set-room-mute.use-case";
import { SetRoomArchivedUseCase } from "@/lib/application/use-cases/rooms/set-room-archived.use-case";

const setRoomMuteUseCase = new SetRoomMuteUseCase(new RoomRepository(db), new PusherService());
const setRoomArchivedUseCase = new SetRoomArchivedUseCase(new RoomRepository(db), new PusherService());

const schema = z.object({
  roomId: z.string().min(1),
  duration: z.enum(["1h", "8h", "1w", "forever", "off"]),
});

export async function setRoomMuteController(userId: string, roomId: string, duration: string) {
  const parsed = schema.safeParse({ roomId, duration });
  if (!parsed.success) throw new Error("Input tidak valid");
  return setRoomMuteUseCase.execute(userId, parsed.data.roomId, parsed.data.duration);
}

export async function setRoomArchivedController(userId: string, roomId: string, archived: boolean) {
  const parsed = z.object({ roomId: z.string().min(1), archived: z.boolean() }).safeParse({ roomId, archived });
  if (!parsed.success) throw new Error("Input tidak valid");
  return setRoomArchivedUseCase.execute(userId, parsed.data.roomId, parsed.data.archived);
}
