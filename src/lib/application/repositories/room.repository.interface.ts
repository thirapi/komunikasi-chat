import { RoomWithParticipantsDTO, SidebarRoomRow } from "@/lib/entities/models/room.model";

export interface IRoomRepository {
  getRoomById(roomId: string): Promise<RoomWithParticipantsDTO | null>;
  getSidebarRooms(userId: string): Promise<SidebarRoomRow[]>;
  getAllRoomsByUserId(
    userId: string,
    options?: { isDirect?: boolean }
  ): Promise<RoomWithParticipantsDTO[] | null>;
  updateLastReadAt(
    userId: string,
    roomId: string,
    messageId: string,
    lastReadAt?: Date
  ): Promise<void>;
  getLastReadAt(userId: string, roomId: string): Promise<{ id: string | null; at: Date | null }>;
  findDirectRoomBetweenUsers(userId1: string, userId2: string): Promise<{ id: string } | null>;
  getOtherParticipants(
    roomId: string,
    excludeUserId: string
  ): Promise<{ userId: string; mutedUntil?: Date | null; archivedAt?: Date | null }[]>;
  setMutedUntil(userId: string, roomId: string, mutedUntil: Date | null): Promise<void>;
  setArchived(userIds: string[], roomId: string, archivedAt: Date | null): Promise<void>;
  getParticipantIds(roomId: string): Promise<string[]>;
  createRoom(
    name: string,
    isDirect: boolean,
    participantIds: string[],
    avatar: string,
    description?: string,
    isPublic?: boolean,
    ownerId?: string
  ): Promise<RoomWithParticipantsDTO>;
  getPublicRooms(excludeUserId: string): Promise<RoomWithParticipantsDTO[]>;
  addParticipant(roomId: string, userId: string): Promise<void>;
  removeParticipant(roomId: string, userId: string): Promise<void>;
  updateRoom(roomId: string, data: { name?: string; description?: string; isPublic?: boolean; avatar?: string; banner?: string }): Promise<void>;
  deleteRoom(roomId: string): Promise<void>;
  fallbackLastReadMessageId(roomId: string, deletedMessageId: string, fallbackBeforeDate: Date): Promise<void>;
  getRoomAccess(
    roomId: string,
    userId: string,
  ): Promise<{ exists: boolean; isMember: boolean; isPublic: boolean; isDirect: boolean; ownerId: string | null }>;
}
