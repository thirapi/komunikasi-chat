import { z } from "zod";
import { db } from "@/lib/db";
import { UserBlockRepository } from "@/lib/infrastructure/repositories/user-block.repository";
import { RoomRepository } from "@/lib/infrastructure/repositories/room.repository";
import { PusherService } from "@/lib/infrastructure/services/pusher.service";
import { BlockUserUseCase } from "@/lib/application/use-cases/users/block-user.use-case";

const blockUserUseCase = new BlockUserUseCase(new UserBlockRepository(db), new RoomRepository(db), new PusherService());

export async function blockUserController(userId: string, targetUserId: string, block: boolean) {
  const parsed = z.object({ targetUserId: z.string().min(1), block: z.boolean() }).safeParse({ targetUserId, block });
  if (!parsed.success) throw new Error("Input tidak valid");
  return blockUserUseCase.execute(userId, parsed.data.targetUserId, parsed.data.block);
}

export async function getRoomBlockStatusController(
  viewerId: string,
  room: { isDirect: boolean; participants?: { user: { id: string } }[] },
) {
  return blockUserUseCase.statusForRoom(viewerId, room);
}
