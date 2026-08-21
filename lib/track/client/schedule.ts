"use client";

/**
 * Runs `cb` after the browser has had a chance to paint, instead of inline in
 * whatever event handler called this. Tracking work (UA parsing, layout
 * reads, JSON serialization) is real but not urgent — running it inline in a
 * click/submit handler delays that interaction's next paint (INP) for no
 * user-visible benefit.
 */
export function scheduleIdle(cb: () => void, timeout = 1000): void {
  if (typeof window === "undefined") {
    cb();
    return;
  }
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(cb, { timeout });
  } else {
    setTimeout(cb, 0);
  }
}
