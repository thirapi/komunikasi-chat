"use client";

import { useEffect, useState } from "react";
import { getPusher } from "@/lib/pusher/pusher.client";

export type ConnectionStatus = "online" | "connecting" | "offline";

/**
 * Realtime connection health, Telegram-style: "connecting" and "offline" only
 * surface after a short grace period so brief blips (tab wake-up, a quick
 * reconnect) never flash in the UI.
 */
export function useConnectionStatus(graceMs = 1500): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>("online");

  useEffect(() => {
    const pusher = getPusher();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const compute = (): ConnectionStatus => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
      const state = pusher.connection.state;
      if (state === "connected") return "online";
      if (state === "unavailable" || state === "failed") return "offline";
      return "connecting";
    };

    const update = () => {
      const next = compute();
      if (timer) clearTimeout(timer);
      if (next === "online") {
        setStatus("online");
      } else {
        timer = setTimeout(() => setStatus(compute()), graceMs);
      }
    };

    update();
    pusher.connection.bind("state_change", update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      if (timer) clearTimeout(timer);
      pusher.connection.unbind("state_change", update);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [graceMs]);

  return status;
}
