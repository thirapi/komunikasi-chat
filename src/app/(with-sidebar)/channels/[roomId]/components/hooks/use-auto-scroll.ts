import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { MessageWithUserDTO } from "@/lib/entities/models/message.model";

/**
 * How close to the bottom (px) still counts as "following the conversation".
 * Small on purpose: someone who scrolled up to reread must not be yanked down.
 */
const STICK_THRESHOLD = 32;

/**
 * Keep the conversation pinned to the newest message while the reader is at
 * the bottom, the way WhatsApp/Telegram behave.
 *
 * `flex-col-reverse` keeps the view at the bottom only while scrollTop is
 * exactly 0. A few pixels off (fractional DPI rounding, a smooth scroll that
 * stopped short, the composer resizing, an image finishing loading) and the
 * browser's scroll anchoring holds the *old* content in place instead, so a new
 * message lands below the fold. The bottom observer still saw its sentinel and
 * marked that message read, which is how users ended up with the newest
 * message "read" but not on screen.
 *
 * Whether we are following is tracked from scroll events, i.e. from the state
 * *before* a change lands, and the re-pin happens in a layout effect, before
 * the browser paints the shifted frame.
 */
export function useAutoScroll(
  messages: MessageWithUserDTO[],
  userId: string,
  viewportRef: React.RefObject<HTMLDivElement | null>,
  /**
   * Whether we are following the bottom. Owned by the caller so every
   * programmatic scroll away from the bottom (unread marker, jump to a reply)
   * can clear it synchronously, before a commit could re-pin.
   */
  stickRef: React.RefObject<boolean>,
) {
  const userInteractedRef = useRef(false);
  const lastIdRef = useRef<string | null>(null);

  const pinToBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    stickRef.current = true;
    // flex-col-reverse: 0 is the bottom, scrolling up goes negative.
    if (viewport.scrollTop !== 0) viewport.scrollTop = 0;
  }, [viewportRef]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onScroll = () => {
      stickRef.current = Math.abs(viewport.scrollTop) <= STICK_THRESHOLD;
    };
    const onUserScroll = () => {
      userInteractedRef.current = true;
    };
    // Images/videos growing after they load: load events do not bubble, so
    // listen in the capture phase.
    const onMediaLoad = () => {
      if (stickRef.current) pinToBottom();
    };
    // The viewport itself resizing (composer grows, reply bar, mobile keyboard).
    const resizeObserver = new ResizeObserver(() => {
      if (stickRef.current) pinToBottom();
    });

    viewport.addEventListener("scroll", onScroll, { passive: true });
    viewport.addEventListener("wheel", onUserScroll, { passive: true });
    viewport.addEventListener("touchstart", onUserScroll, { passive: true });
    viewport.addEventListener("pointerdown", onUserScroll, { passive: true });
    viewport.addEventListener("keydown", onUserScroll);
    viewport.addEventListener("load", onMediaLoad, true);
    resizeObserver.observe(viewport);
    return () => {
      viewport.removeEventListener("scroll", onScroll);
      viewport.removeEventListener("wheel", onUserScroll);
      viewport.removeEventListener("touchstart", onUserScroll);
      viewport.removeEventListener("pointerdown", onUserScroll);
      viewport.removeEventListener("keydown", onUserScroll);
      viewport.removeEventListener("load", onMediaLoad, true);
      resizeObserver.disconnect();
    };
  }, [viewportRef, pinToBottom]);

  // New rows: follow them if we were following, and always follow our own send.
  useLayoutEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    const isNewTail = lastIdRef.current !== null && last.id !== lastIdRef.current;
    lastIdRef.current = last.id;
    // A message this user just sent from here (still optimistic) always
    // brings the view down, even if they had scrolled up.
    if (isNewTail && last.userId === userId && last.isOptimistic) {
      pinToBottom();
      return;
    }
    if (stickRef.current) pinToBottom();
  }, [messages, userId, pinToBottom]);

  return { userInteractedRef, pinToBottom };
}
