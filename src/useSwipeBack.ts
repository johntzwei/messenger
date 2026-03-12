import { useEffect, useRef } from "react";
import type { RefObject } from "react";

const THRESHOLD = 80;

export function useSwipeBack(ref: RefObject<HTMLElement | null>, onBack: () => void) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      // Only start tracking from the left 40px edge
      if (t.clientX > 40) return;
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
      el.style.transition = "none";
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      // Cancel if vertical movement dominates
      if (Math.abs(dy) > Math.abs(dx) * 1.5) {
        tracking = false;
        el.style.transition = "transform 0.2s ease-out";
        el.style.transform = "";
        return;
      }

      // Only allow rightward movement
      if (dx > 0) {
        el.style.transform = `translateX(${dx}px)`;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.changedTouches[0].clientX - startX;

      if (dx > THRESHOLD) {
        // Animate off screen then navigate
        el.style.transition = "transform 0.2s ease-out";
        el.style.transform = "translateX(100%)";
        setTimeout(() => onBackRef.current(), 200);
      } else {
        // Snap back
        el.style.transition = "transform 0.2s ease-out";
        el.style.transform = "";
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.style.transition = "";
      el.style.transform = "";
    };
  }, [ref]);
}
