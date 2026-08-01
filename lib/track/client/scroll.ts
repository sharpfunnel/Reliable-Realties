"use client";

import { track } from "@/lib/track/client/queue";

const MILESTONES = [25, 50, 75, 100];

export function initScrollTracking() {
  const pageStart = Date.now();
  const reached = new Set<number>();
  let ticking = false;

  function currentDepth() {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return 100;
    return Math.min(100, Math.round(((window.scrollY || doc.scrollTop) / scrollable) * 100));
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const depth = currentDepth();
      for (const milestone of MILESTONES) {
        if (depth >= milestone && !reached.has(milestone)) {
          reached.add(milestone);
          track.scroll({
            path: window.location.pathname,
            depth: milestone,
            timeToReach: Date.now() - pageStart,
          });
        }
      }
      ticking = false;
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  return () => window.removeEventListener("scroll", onScroll);
}
