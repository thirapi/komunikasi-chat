import { useCallback, useEffect, useRef, useState } from "react";

/** Horizontal distance (px) that commits a swipe-to-reply. */
const SWIPE_COMMIT = 56;
/** How far the row follows the finger before it stops. */
const SWIPE_MAX = 80;
/** Hold time for a long-press. */
const LONG_PRESS_MS = 420;
/** Movement that turns a press into a scroll/swipe. */
const MOVE_TOLERANCE = 10;

function buzz() {
  // Native haptics are fired by the caller; this covers Android browsers.
  try {
    navigator.vibrate?.(8);
  } catch {
    /* not supported */
  }
}

/**
 * Touch gestures on a chat message, WhatsApp/Telegram-style:
 * - swipe right to reply (the row follows the finger, commits past ~56px)
 * - long-press to open the message actions
 *
 * Vertical movement is left to the browser (the row gets `touch-action:
 * pan-y`), so scrolling the conversation never triggers either gesture. React
 * registers touch listeners as passive, which is why the CSS, not
 * preventDefault, is what keeps horizontal drags from scrolling.
 */
export function useMessageGestures({
  enabled,
  onSwipeReply,
  onLongPress,
}: {
  enabled: boolean;
  onSwipeReply: () => void;
  onLongPress: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const mode = useRef<"idle" | "press" | "swipe" | "scroll" | "longpressed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committed = useRef(false);
  // The click that follows a long-press or a swipe must not count as a tap.
  const suppressClick = useRef(false);

  const cancelTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => cancelTimer, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || e.touches.length !== 1) return;
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
      mode.current = "press";
      committed.current = false;
      suppressClick.current = false;
      cancelTimer();
      timer.current = setTimeout(() => {
        if (mode.current !== "press") return;
        mode.current = "longpressed";
        buzz();
        onLongPress();
      }, LONG_PRESS_MS);
    },
    [enabled, onLongPress],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !start.current) return;
      const t = e.touches[0];
      const dx = t.clientX - start.current.x;
      const dy = t.clientY - start.current.y;

      if (mode.current === "press") {
        if (Math.abs(dy) > MOVE_TOLERANCE && Math.abs(dy) > Math.abs(dx)) {
          mode.current = "scroll";
          cancelTimer();
        } else if (dx > MOVE_TOLERANCE && dx > Math.abs(dy)) {
          mode.current = "swipe";
          cancelTimer();
        } else if (Math.abs(dx) > MOVE_TOLERANCE) {
          // Leftwards: not a gesture we use, and not a long-press any more.
          mode.current = "scroll";
          cancelTimer();
        }
      }

      if (mode.current === "swipe") {
        // Follows the finger, with resistance past the commit point.
        const raw = Math.max(0, dx - MOVE_TOLERANCE);
        const eased = raw <= SWIPE_COMMIT ? raw : SWIPE_COMMIT + (raw - SWIPE_COMMIT) * 0.3;
        const next = Math.min(SWIPE_MAX, eased);
        if (!committed.current && next >= SWIPE_COMMIT) {
          committed.current = true;
          buzz();
        } else if (committed.current && next < SWIPE_COMMIT) {
          committed.current = false;
        }
        setOffset(next);
      }
    },
    [enabled],
  );

  const end = useCallback(() => {
    cancelTimer();
    if (mode.current === "longpressed" || mode.current === "swipe") suppressClick.current = true;
    if (mode.current === "swipe" && committed.current) onSwipeReply();
    mode.current = "idle";
    start.current = null;
    committed.current = false;
    setOffset(0);
  }, [onSwipeReply]);

  return {
    offset,
    /** Call from onClick: true (once) when that click ended a long-press or swipe. */
    consumeGestureClick: () => {
      const was = suppressClick.current;
      suppressClick.current = false;
      return was;
    },
    handlers: enabled
      ? { onTouchStart, onTouchMove, onTouchEnd: end, onTouchCancel: end }
      : {},
  };
}
