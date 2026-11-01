// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMessageGestures } from "./use-message-gestures";

const touch = (x: number, y: number) => ({ touches: [{ clientX: x, clientY: y }] }) as unknown as React.TouchEvent;

function setup() {
  const onSwipeReply = vi.fn();
  const onLongPress = vi.fn();
  const hook = renderHook(() => useMessageGestures({ enabled: true, onSwipeReply, onLongPress }));
  const h = () => hook.result.current.handlers as Required<ReturnType<typeof useMessageGestures>["handlers"]> & {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  return { hook, h, onSwipeReply, onLongPress };
}

describe("useMessageGestures", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("replies on a swipe right past the commit point, and the row follows", () => {
    const { hook, h, onSwipeReply, onLongPress } = setup();
    act(() => h().onTouchStart(touch(10, 100)));
    act(() => h().onTouchMove(touch(40, 102)));
    act(() => h().onTouchMove(touch(90, 103)));
    expect(hook.result.current.offset).toBeGreaterThan(50);
    act(() => h().onTouchEnd());
    expect(onSwipeReply).toHaveBeenCalledTimes(1);
    expect(onLongPress).not.toHaveBeenCalled();
    expect(hook.result.current.offset).toBe(0);
    // The click that ends the swipe is swallowed.
    expect(hook.result.current.consumeGestureClick()).toBe(true);
  });

  it("does not reply on a short swipe", () => {
    const { h, onSwipeReply } = setup();
    act(() => h().onTouchStart(touch(10, 100)));
    act(() => h().onTouchMove(touch(45, 100)));
    act(() => h().onTouchEnd());
    expect(onSwipeReply).not.toHaveBeenCalled();
  });

  it("opens actions on a long-press, and swallows the click after it", () => {
    const { hook, h, onLongPress } = setup();
    act(() => h().onTouchStart(touch(10, 100)));
    act(() => vi.advanceTimersByTime(450));
    expect(onLongPress).toHaveBeenCalledTimes(1);
    act(() => h().onTouchEnd());
    expect(hook.result.current.consumeGestureClick()).toBe(true);
    expect(hook.result.current.consumeGestureClick()).toBe(false);
  });

  it("does nothing while the user scrolls vertically", () => {
    const { hook, h, onSwipeReply, onLongPress } = setup();
    act(() => h().onTouchStart(touch(10, 100)));
    act(() => h().onTouchMove(touch(14, 160)));
    act(() => vi.advanceTimersByTime(600));
    act(() => h().onTouchMove(touch(80, 200)));
    act(() => h().onTouchEnd());
    expect(onLongPress).not.toHaveBeenCalled();
    expect(onSwipeReply).not.toHaveBeenCalled();
    expect(hook.result.current.offset).toBe(0);
  });

  it("a plain tap is a normal click", () => {
    const { hook, h } = setup();
    act(() => h().onTouchStart(touch(10, 100)));
    act(() => h().onTouchEnd());
    expect(hook.result.current.consumeGestureClick()).toBe(false);
  });

  it("is inert when disabled", () => {
    const { result } = renderHook(() =>
      useMessageGestures({ enabled: false, onSwipeReply: vi.fn(), onLongPress: vi.fn() }),
    );
    expect(result.current.handlers).toEqual({});
  });
});
