"use client";

import type React from "react";
import { clientChatCache } from "@/lib/infrastructure/cache/client-cache";
import { getRoomSnapshot } from "@/app/(with-sidebar)/channels/[roomId]/room.action";

const ROOM_PATH = /^\/channels\/([^/?#]+)/;

/** The room id in a /channels/<id> path, or null for the empty state. */
export function roomIdFromPath(pathname: string | null | undefined) {
  const id = pathname?.match(ROOM_PATH)?.[1];
  return id && id !== "default" ? decodeURIComponent(id) : null;
}

/** True for a plain left click; modified clicks keep their browser meaning. */
export function isPlainLeftClick(e: React.MouseEvent) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

/** Set while <RoomHost> is mounted (i.e. the user is somewhere under /channels). */
let roomHostMounted = false;

export function setRoomHostMounted(mounted: boolean) {
  roomHostMounted = mounted;
}

type RouterLike = { push: (href: string) => void };

/**
 * Switch chats without a server round-trip.
 *
 * Next.js integrates `history.pushState` with its router: `usePathname` updates
 * on the same frame and back/forward keep working, but no RSC payload is
 * requested. The room itself is rendered by <RoomHost> from the client cache,
 * so the switch is a single client render — the way Telegram Web feels.
 *
 * That only works while <RoomHost> (the /channels layout) is on screen. From
 * other pages (profile, settings) a pushState would change the URL but leave
 * the old page rendered, so those go through the router instead.
 */
export function navigateToRoom(url: string, router: RouterLike) {
  if (typeof window === "undefined") return;
  if (!roomHostMounted) {
    router.push(url);
    return;
  }
  if (window.location.pathname + window.location.search === url) return;
  window.history.pushState(null, "", url);
}

const inflight = new Map<string, Promise<void>>();

/**
 * Make sure a room can paint instantly when opened: lift it from IndexedDB into
 * the in-memory cache, and only if it has never been cached fetch it from the
 * server. Safe to call repeatedly (hover, focus, touchstart); work is deduped.
 */
export function prefetchRoom(roomId: string) {
  if (typeof window === "undefined" || !roomId) return Promise.resolve();
  if (clientChatCache.getRoomSync(roomId) && clientChatCache.getMessagesSync(roomId)) {
    return Promise.resolve();
  }
  const existing = inflight.get(roomId);
  if (existing) return existing;

  const task = (async () => {
    try {
      const [room, messages] = await Promise.all([
        clientChatCache.getRoom(roomId),
        clientChatCache.getMessages(roomId),
        clientChatCache.getLastRead(roomId),
      ]);
      if (room && messages) return;

      const res = await getRoomSnapshot(roomId);
      if (res.status !== "success" || !res.data) return;
      const { room: roomData, messages: fetched, lastRead } = res.data;
      await clientChatCache.setRoom(roomId, roomData);
      await clientChatCache.setMessages(roomId, fetched);
      await clientChatCache.setLastRead(roomId, lastRead.id, lastRead.at ? new Date(lastRead.at) : null);
    } catch (e) {
      console.warn("[prefetchRoom] failed", e);
    } finally {
      inflight.delete(roomId);
    }
  })();

  inflight.set(roomId, task);
  return task;
}

/**
 * Lift the most recent rooms from IndexedDB into memory while the browser is
 * idle. IndexedDB only — no network — so it is cheap to run on every load.
 */
export function warmRecentRooms(roomIds: string[]) {
  if (typeof window === "undefined" || roomIds.length === 0) return () => {};
  const run = () => {
    for (const id of roomIds) {
      void clientChatCache.getRoom(id);
      void clientChatCache.getMessages(id);
      void clientChatCache.getLastRead(id);
    }
  };
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (w.requestIdleCallback) {
    const handle = w.requestIdleCallback(run, { timeout: 3000 });
    return () => w.cancelIdleCallback?.(handle);
  }
  const t = setTimeout(run, 1200);
  return () => clearTimeout(t);
}
