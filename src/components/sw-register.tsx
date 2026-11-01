"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (offline asset cache, push display) on every
 * page. Push *subscription* is not done here: it needs a signed-in user and an
 * active worker, so it lives in WebPushSubscription inside the signed-in tree.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
        console.warn("[sw] registration failed", error);
      });
    };
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
