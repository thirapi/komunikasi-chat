"use client";

import { useEffect } from "react";
import { savePushSubscriptionAction } from "@/app/push.action";
import { isNative } from "@/lib/native/platform";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/**
 * Subscribes this browser to Web Push for the signed-in user.
 *
 * - Mounted only in the signed-in layout, so nothing happens on the login page.
 * - Waits for `serviceWorker.ready` (an *active* worker); subscribing right
 *   after register() failed with "no active Service Worker".
 * - Never triggers the permission prompt itself: it subscribes once permission
 *   is granted (now, or later when the user allows notifications).
 * - Re-saves the subscription only when it changes for this user.
 */
export function WebPushSubscription({ userId }: { userId: string }) {
  useEffect(() => {
    if (!VAPID_PUBLIC_KEY || isNative()) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") return;

    let cancelled = false;
    let permissionStatus: PermissionStatus | null = null;

    const subscribe = async () => {
      if (cancelled || Notification.permission !== "granted") return;
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY }));
        if (cancelled) return;

        const key = `komunikasi:push:${userId}`;
        let saved: string | null = null;
        try { saved = localStorage.getItem(key); } catch {}
        if (saved === subscription.endpoint) return;

        const result = await savePushSubscriptionAction(JSON.parse(JSON.stringify(subscription)));
        if (result.status === "success") {
          try { localStorage.setItem(key, subscription.endpoint); } catch {}
        }
      } catch (error) {
        // Unsupported browser, blocked push service, private mode…: in-app
        // realtime notifications still work, so this is not an error.
        console.info("[push] web push unavailable", error);
      }
    };

    void subscribe();

    // Subscribe as soon as the user grants permission later on.
    navigator.permissions
      ?.query({ name: "notifications" as PermissionName })
      .then((status) => {
        if (cancelled) return;
        permissionStatus = status;
        status.onchange = () => void subscribe();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, [userId]);

  return null;
}
