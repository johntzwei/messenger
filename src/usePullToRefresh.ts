import { useEffect, useRef } from "react";
import type { RefObject } from "react";

export function usePullToRefresh(ref: RefObject<HTMLElement | null>, threshold = 80) {
  const startY = useRef(0);
  const pulling = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (el.scrollTop <= 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > threshold) {
        el.setAttribute("data-pull-refresh", "ready");
      } else if (dy > 0) {
        el.setAttribute("data-pull-refresh", "pulling");
      } else {
        el.removeAttribute("data-pull-refresh");
        pulling.current = false;
      }
    };

    const onTouchEnd = () => {
      if (!pulling.current) return;
      const ready = el.getAttribute("data-pull-refresh") === "ready";
      el.removeAttribute("data-pull-refresh");
      pulling.current = false;
      if (ready) window.location.reload();
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [ref, threshold]);
}
