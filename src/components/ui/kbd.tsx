"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** True on macOS / iOS, where the modifier key is ⌘ instead of Ctrl. */
export function useIsMac() {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    const platform =
      (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ||
      navigator.platform ||
      navigator.userAgent;
    setIsMac(/mac|iphone|ipad|ipod/i.test(platform));
  }, []);
  return isMac;
}

/** "mod" renders as ⌘ on Mac and Ctrl elsewhere; other keys render as given. */
export function keyLabel(key: string, isMac: boolean) {
  switch (key.toLowerCase()) {
    case "mod": return isMac ? "⌘" : "Ctrl";
    case "shift": return isMac ? "⇧" : "Shift";
    case "alt": return isMac ? "⌥" : "Alt";
    case "enter": return "Enter";
    case "esc": return "Esc";
    case "up": return "↑";
    case "down": return "↓";
    default: return key.length === 1 ? key.toUpperCase() : key;
  }
}

export function Kbd({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted/60 px-1",
        "font-sans text-[11px] font-medium leading-none text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/**
 * A keyboard shortcut as separate keycaps, e.g. keys={["mod", "k"]} →
 * [Ctrl] [K] on Windows/Linux and [⌘] [K] on Mac. One component everywhere, so
 * shortcut hints always have the same glyphs and spacing.
 */
export function Shortcut({ keys, className, keyClassName }: { keys: string[]; className?: string; keyClassName?: string }) {
  const isMac = useIsMac();
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-label={keys.map((k) => keyLabel(k, isMac)).join("+")}>
      {keys.map((k) => (
        <Kbd key={k} className={keyClassName}>{keyLabel(k, isMac)}</Kbd>
      ))}
    </span>
  );
}
