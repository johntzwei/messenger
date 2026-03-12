import { useEffect, useRef } from "react";
import type { RefObject } from "react";

export function useSwipeGesture(
  ref: RefObject<HTMLElement | null>,
  direction: "right" | "down",
  threshold: number,
  onSwipe: () => void,
) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!start.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.current.x;
      const dy = t.clientY - start.current.y;
      start.current = null;

      if (direction === "right" && dx > threshold && Math.abs(dx) > Math.abs(dy) * 1.5) {
        onSwipeRef.current();
      }
      if (direction === "down" && dy > threshold && Math.abs(dy) > Math.abs(dx) * 1.5) {
        onSwipeRef.current();
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [ref, direction, threshold]);
}
