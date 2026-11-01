/**
 * Shared fake session for server-action tests. The real authorization module
 * (src/lib/auth/actor.ts) runs; only its inputs — the session, the
 * impersonation cookie and the room/message lookups — are faked here.
 */
export type Access = { exists: boolean; isMember: boolean; isPublic: boolean; isDirect: boolean; ownerId: string | null };

export const authState = {
  sessionUserId: "user1" as string | null,
  impersonatedUserId: null as string | null,
  access: { exists: true, isMember: true, isPublic: false, isDirect: false, ownerId: "user1" } as Access,
  messageRoomId: "r1" as string | null,
};

export function resetAuthState() {
  authState.sessionUserId = "user1";
  authState.impersonatedUserId = null;
  authState.access = { exists: true, isMember: true, isPublic: false, isDirect: false, ownerId: "user1" };
  authState.messageRoomId = "r1";
}

export const authActionMock = () => ({
  getUserSession: async () => (authState.sessionUserId ? { user: { id: authState.sessionUserId, username: "u" } } : null),
  getUserWithRolesFromSession: async () => ({ id: authState.sessionUserId }),
});

export const impersonateMock = () => ({
  getImpersonatedUserId: async () => authState.impersonatedUserId,
  requireNoImpersonation: async () => {},
});

export const roomRepoMock = () => ({
  RoomRepository: class {
    async getRoomAccess() {
      return authState.access;
    }
  },
});

export const messageRepoMock = () => ({
  MessageRepository: class {
    async getRoomIdByMessageId() {
      return authState.messageRoomId;
    }
  },
});
