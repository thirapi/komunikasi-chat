import { RoomRole, RoomWithParticipantsDTO } from "@/lib/entities/models/room.model";

/** A user's role in a room from getRoomById data, or null if not a member. */
export function roleIn(room: Pick<RoomWithParticipantsDTO, "ownerId" | "participants">, userId: string): RoomRole | null {
  if (room.ownerId === userId) return "owner";
  const p = room.participants.find((x) => x.user.id === userId);
  if (!p) return null;
  return p.role === "admin" ? "admin" : "member";
}
