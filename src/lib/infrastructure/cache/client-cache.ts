// src/lib/infrastructure/cache/client-cache.ts
import type { EntityTable } from 'dexie';
import { MessageWithUserDTO } from "@/lib/entities/models/message.model";

export interface RoomMetadata {
  roomId: string;
  roomData: any;
  lastReadId: string | null;
  lastReadAt: string | null;
  /**
   * Server cursor from the last sync of this room's messages (ISO). Not an
   * index, so adding it needs no Dexie schema version bump.
   */
  syncCursor?: string | null;
}

export interface ChatCacheDb {
  messages: EntityTable<MessageWithUserDTO, 'id'>;
  roomMetadata: EntityTable<RoomMetadata, 'roomId'>;
}

const DB_NAME = 'KomunikasiClientDB';
const MAX_CACHED_ROOMS = 20;
const MAX_MESSAGES_PER_ROOM = 50;

let dbPromise: Promise<ChatCacheDb> | null = null;

/**
 * Dexie is loaded on demand so it never lands in the eager client bundle.
 * Only the IndexedDB-backed paths below pay for it.
 */
function getDb(): Promise<ChatCacheDb> {
  if (dbPromise === null) {
    dbPromise = import('dexie').then(({ default: Dexie }) => {
      class KomunikasiDB extends Dexie {
        messages!: EntityTable<MessageWithUserDTO, 'id'>;
        roomMetadata!: EntityTable<RoomMetadata, 'roomId'>;

        constructor() {
          super(DB_NAME);
          this.version(1).stores({
            messages: 'id, roomId, createdAt',
            roomMetadata: 'roomId'
          });
        }
      }
      return new KomunikasiDB() as unknown as ChatCacheDb;
    });
  }
  return dbPromise;
}

/** Oldest-inserted key first, so we can evict the least recently warmed room. */
function oldestKey<V>(map: Map<string, V>) {
  for (const key of map.keys()) return key;
  return null;
}

class ClientChatCache {
  private memMessages = new Map<string, MessageWithUserDTO[]>();
  private memRooms = new Map<string, any>();
  private memLastRead = new Map<string, { id: string | null; at: Date | null }>();
  private memCursor = new Map<string, string | null>();

  private evictIfNeeded() {
    if (this.memRooms.size <= MAX_CACHED_ROOMS) return;
    const key = oldestKey(this.memRooms);
    if (key === null) return;
    this.memRooms.delete(key);
    this.memMessages.delete(key);
    this.memLastRead.delete(key);
    this.memCursor.delete(key);
  }

  getMessagesSync(roomId: string) { return this.memMessages.get(roomId); }
  getRoomSync(roomId: string) { return this.memRooms.get(roomId); }
  getLastReadSync(roomId: string) { return this.memLastRead.get(roomId) || { id: null, at: null }; }

  private pruneExcess(allMsgs: MessageWithUserDTO[]) {
    const optimistics = allMsgs.filter(m => m.id.startsWith('optimistic-') || m.isOptimistic);
    const validMsgs = allMsgs.filter(m => !m.id.startsWith('optimistic-') && !m.isOptimistic);
    const toDeleteIds = optimistics.map(m => m.id);
    let limited = validMsgs;

    if (validMsgs.length > MAX_MESSAGES_PER_ROOM) {
      const excess = validMsgs.slice(0, validMsgs.length - MAX_MESSAGES_PER_ROOM);
      toDeleteIds.push(...excess.map(m => m.id));
      limited = validMsgs.slice(validMsgs.length - MAX_MESSAGES_PER_ROOM);
    }

    return { toDeleteIds, limited };
  }

  async setMessages(roomId: string, messages: MessageWithUserDTO[]) {
    if (typeof window === "undefined" || !messages || messages.length === 0) return;
    try {
      const db = await getDb();
      const limited = messages.slice(-MAX_MESSAGES_PER_ROOM);
      this.memMessages.set(roomId, limited);
      this.evictIfNeeded();
      await db.messages.bulkPut(limited); // Will update existing, insert new

      // Purge leftovers and enforce the per-room limit
      const allMsgs = await db.messages.where('roomId').equals(roomId).sortBy('createdAt');
      const { toDeleteIds } = this.pruneExcess(allMsgs);

      if (toDeleteIds.length > 0) {
        await db.messages.bulkDelete(toDeleteIds);
      }
    } catch (e) {
      console.warn("Failed to set messages in IndexedDB", e);
    }
  }

  async mergeMessages(roomId: string, newMessages: MessageWithUserDTO[]) {
    if (typeof window === "undefined" || !newMessages || newMessages.length === 0) return;
    try {
      const db = await getDb();
      // Just put them, since Dexie stores the source of truth individually per id
      await db.messages.bulkPut(newMessages);

      // Now enforce the per-room limit by querying locally
      const allMsgs = await db.messages
        .where('roomId')
        .equals(roomId)
        .sortBy('createdAt');

      const { toDeleteIds, limited } = this.pruneExcess(allMsgs);

      if (toDeleteIds.length > 0) {
        await db.messages.bulkDelete(toDeleteIds);
      }

      this.memMessages.set(roomId, limited);
    } catch (e) {
      console.warn("Failed to merge messages in IndexedDB", e);
    }
  }

  /**
   * A message that arrived live for a room that is not open (via the user
   * channel). Written into the in-memory copy synchronously, so opening that
   * room right after the sidebar lit up already shows it on the first frame
   * instead of the stale cached tail followed by a pop-in once the network
   * catches up. Rooms that were never cached are left alone; they load fresh.
   */
  appendLive(roomId: string, message: MessageWithUserDTO) {
    if (typeof window === "undefined" || !message?.id) return;
    if (message.isOptimistic || message.id.startsWith("optimistic-")) return;
    const cached = this.memMessages.get(roomId);
    if (!cached || !this.memRooms.has(roomId)) return;
    if (cached.some((m) => m.id === message.id)) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isOptimistic, sendError, uploadProgress, ...clean } = message;
    const next = [...cached, clean].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    this.memMessages.set(roomId, next.slice(-MAX_MESSAGES_PER_ROOM));
    void this.mergeMessages(roomId, [clean]);
  }

  /**
   * The cursor to send with the next sync, or null when the cached messages
   * cannot be trusted as a base (nothing cached for the room).
   */
  async getSyncCursor(roomId: string): Promise<string | null> {
    if (typeof window === "undefined") return null;
    if (this.memCursor.has(roomId)) return this.memCursor.get(roomId) ?? null;
    try {
      const db = await getDb();
      const meta = await db.roomMetadata.get(roomId);
      const cursor = meta?.syncCursor ?? null;
      this.memCursor.set(roomId, cursor);
      return cursor;
    } catch {
      return null;
    }
  }

  async setSyncCursor(roomId: string, cursor: Date | string | null) {
    if (typeof window === "undefined") return;
    const iso = cursor ? new Date(cursor).toISOString() : null;
    this.memCursor.set(roomId, iso);
    try {
      const db = await getDb();
      const existing = await db.roomMetadata.get(roomId);
      await db.roomMetadata.put({
        roomId,
        roomData: existing?.roomData ?? null,
        lastReadId: existing?.lastReadId ?? null,
        lastReadAt: existing?.lastReadAt ?? null,
        syncCursor: iso,
      });
    } catch (e) {
      console.warn("Failed to set sync cursor in IndexedDB", e);
    }
  }

  /**
   * Apply a delta from the server onto the cached messages and return the
   * resulting list (oldest first). Changed rows replace their cached copy;
   * new rows are added unless they are older than the cached window (an old
   * message edited while we were away must not open a gap in the history);
   * deleted rows are dropped.
   */
  applyDelta(
    roomId: string,
    base: MessageWithUserDTO[],
    changed: MessageWithUserDTO[],
    deletedIds: string[],
  ): MessageWithUserDTO[] {
    const deleted = new Set(deletedIds);
    const byId = new Map(base.filter((m) => !deleted.has(m.id)).map((m) => [m.id, m]));
    const oldest = base.length ? new Date(base[0].createdAt).getTime() : -Infinity;
    for (const m of changed) {
      if (byId.has(m.id) || new Date(m.createdAt).getTime() >= oldest) byId.set(m.id, m);
    }
    const next = [...byId.values()]
      .filter((m) => !m.isOptimistic && !m.id.startsWith("optimistic-"))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-MAX_MESSAGES_PER_ROOM);
    this.memMessages.set(roomId, next);
    void (async () => {
      try {
        const db = await getDb();
        if (deletedIds.length) await db.messages.bulkDelete(deletedIds);
        if (next.length) await db.messages.bulkPut(next);
        const all = await db.messages.where("roomId").equals(roomId).sortBy("createdAt");
        const { toDeleteIds } = this.pruneExcess(all);
        if (toDeleteIds.length) await db.messages.bulkDelete(toDeleteIds);
      } catch (e) {
        console.warn("Failed to apply delta in IndexedDB", e);
      }
    })();
    return next;
  }

  async removeMessage(roomId: string, messageId: string) {
    if (typeof window === "undefined") return;
    try {
      const db = await getDb();
      await db.messages.delete(messageId);
      const cached = this.memMessages.get(roomId);
      if (cached) {
        this.memMessages.set(roomId, cached.filter(m => m.id !== messageId));
      }
    } catch (e) {
      console.warn("Failed to remove message in IndexedDB", e);
    }
  }

  async setRoom(roomId: string, roomData: any) {
    if (typeof window === "undefined") return;
    try {
      const db = await getDb();
      this.memRooms.set(roomId, roomData);
      this.evictIfNeeded();
      const existing = await db.roomMetadata.get(roomId);
      await db.roomMetadata.put({
        roomId,
        roomData,
        lastReadId: existing?.lastReadId ?? null,
        lastReadAt: existing?.lastReadAt ?? null,
        syncCursor: existing?.syncCursor ?? null,
      });
    } catch (e) {
      console.warn("Failed to set room in IndexedDB", e);
    }
  }

  async setLastRead(roomId: string, messageId: string | null, lastReadAt?: Date | null) {
    if (typeof window === "undefined") return;
    try {
      const db = await getDb();
      const existing = await db.roomMetadata.get(roomId);

      // Harden against race conditions: only update if the new timestamp is newer than existing
      if (existing?.lastReadAt && lastReadAt) {
        const existingDate = new Date(existing.lastReadAt);
        if (lastReadAt < existingDate) {
          console.log("Ignoring out-of-order read state update for room", roomId);
          return;
        }
      }

      this.memLastRead.set(roomId, { id: messageId, at: lastReadAt || null });
      await db.roomMetadata.put({
        roomId,
        roomData: existing?.roomData ?? null,
        lastReadId: messageId,
        lastReadAt: lastReadAt ? lastReadAt.toISOString() : (existing?.lastReadAt ?? null),
        syncCursor: existing?.syncCursor ?? null,
      });
    } catch (e) {
      console.warn("Failed to set last read in IndexedDB", e);
    }
  }

  async getMessages(roomId: string): Promise<MessageWithUserDTO[] | undefined> {
    if (typeof window === "undefined") return undefined;
    if (this.memMessages.has(roomId)) return this.memMessages.get(roomId);
    try {
      const db = await getDb();
      const msgs = await db.messages.where('roomId').equals(roomId).sortBy('createdAt');
      if (msgs.length > 0) {
        this.memMessages.set(roomId, msgs);
        return msgs;
      }
      return undefined;
    } catch (e) {
      console.warn("Failed to get messages from IndexedDB", e);
      return undefined;
    }
  }

  async getRoom(roomId: string): Promise<any | undefined> {
    if (typeof window === "undefined") return undefined;
    if (this.memRooms.has(roomId)) return this.memRooms.get(roomId);
    try {
      const db = await getDb();
      const meta = await db.roomMetadata.get(roomId);
      if (meta?.roomData) {
        this.memRooms.set(roomId, meta.roomData);
        return meta.roomData;
      }
      return undefined;
    } catch (e) {
      console.warn("Failed to get room from IndexedDB", e);
      return undefined;
    }
  }

  async getLastRead(roomId: string): Promise<{ id: string | null; at: Date | null }> {
    if (typeof window === "undefined") return { id: null, at: null };
    if (this.memLastRead.has(roomId)) return this.memLastRead.get(roomId)!;
    try {
      const db = await getDb();
      const meta = await db.roomMetadata.get(roomId);
      const res = {
        id: meta?.lastReadId || null,
        at: meta?.lastReadAt ? new Date(meta.lastReadAt) : null,
      };
      this.memLastRead.set(roomId, res);
      return res;
    } catch (e) {
      console.warn("Failed to get last read from IndexedDB", e);
      return { id: null, at: null };
    }
  }

  /**
   * Drop every cached room and message, in memory and in IndexedDB. Called on
   * sign-out and whenever a different account signs in on this browser, so the
   * next person at a shared computer never sees the previous user's chats.
   */
  async clearAll() {
    if (typeof window === "undefined") return;
    this.memMessages.clear();
    this.memRooms.clear();
    this.memLastRead.clear();
    this.memCursor.clear();
    try {
      const db = await getDb();
      await Promise.all([db.messages.clear(), db.roomMetadata.clear()]);
    } catch (e) {
      console.warn("Failed to clear IndexedDB cache", e);
    }
  }

  /** Clear the cache if it was written by a different account. */
  async ensureOwner(userId: string) {
    if (typeof window === "undefined" || !userId) return;
    const KEY = "komunikasi:cache-owner";
    let owner: string | null = null;
    try { owner = localStorage.getItem(KEY); } catch {}
    if (owner !== userId) {
      await this.clearAll();
      try { localStorage.setItem(KEY, userId); } catch {}
    }
  }

  async invalidate(roomId: string) {
    if (typeof window === "undefined") return;
    try {
      const db = await getDb();
      this.memMessages.delete(roomId);
      this.memRooms.delete(roomId);
      this.memLastRead.delete(roomId);
      this.memCursor.delete(roomId);
      await db.messages.where('roomId').equals(roomId).delete();
      await db.roomMetadata.delete(roomId);
    } catch (e) {
      console.warn("Failed to invalidate IndexedDB for room", e);
    }
  }
}

export const clientChatCache = new ClientChatCache();
