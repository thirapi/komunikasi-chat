"use client";

import { useEffect } from "react";
import { PushNotifications } from "@capacitor/push-notifications";
import { isNative, platform } from "@/lib/native/platform";
import { saveFcmTokenAction } from "@/app/push.action";
import { whenSignedIn } from "@/lib/session-signal";

/**
 * Registers the native Android app for Firebase Cloud Messaging push.
 *
 * Web Push keeps using the VAPID service worker, so the two transports coexist:
 * FCM cannot reach devices without Google Play Services, and VAPID cannot reach
 * a native app at all.
 */
export function NativePushRegistration() {
  useEffect(() => {
    if (!isNative()) return;
    // FCM has no iOS story here, and the decision was Android-only.
    if (platform() !== "android") return;

    let cancelled = false;

    // The token is saved for the signed-in user, so wait for login (this
    // component lives in the root layout and also renders on the login page).
    const stopWaiting = whenSignedIn(() => void (async () => {
      try {
        const permission = await PushNotifications.requestPermissions();
        if (permission.receive !== "granted" || cancelled) return;

        // Capacitor 8 delivers the token through the `registration` event;
        // register() itself resolves with void.
        const listener = await PushNotifications.addListener("registration", (t) => {
          void saveFcmTokenAction(t.value).then((r) => {
            if (r.status !== "success") {
              console.warn("[push] FCM token was not saved", r.error);
            }
          });
        });
        if (cancelled) {
          void listener.remove();
          return;
        }

        await PushNotifications.register();
        if (cancelled) void listener.remove();
      } catch (e) {
        // Expected on devices without Google Play Services.
        console.info(
          "[push] native push unavailable on this device; web push will be used instead",
          e,
        );
      }
    })());

    return () => {
      cancelled = true;
      stopWaiting();
    };
  }, []);

  return null;
}
