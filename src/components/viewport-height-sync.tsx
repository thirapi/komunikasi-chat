"use client";

import { useEffect } from "react";

/**
 * Keeps `--app-height` equal to the *visible* viewport, so the chat layout
 * (composer at the bottom) shrinks to sit right above the on-screen keyboard.
 *
 * Android Chrome does this by itself with `interactive-widget=resizes-content`
 * (set in the root viewport) and the Capacitor shell resizes the WebView, but
 * iOS Safari keeps the layout viewport full height and slides the page up
 * under the keyboard instead, hiding the header and pushing the composer
 * around. visualViewport reports the real visible height on every platform.
 */
export function ViewportHeightSync() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let frame = 0;

    const apply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty("--app-height", `${Math.round(vv.height)}px`);
        // iOS pans the page when the keyboard opens; the layout already fits
        // the visible area, so undo that pan.
        if (window.scrollY !== 0 && vv.height < window.innerHeight) window.scrollTo(0, 0);
      });
    };

    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      root.style.removeProperty("--app-height");
    };
  }, []);

  return null;
}
