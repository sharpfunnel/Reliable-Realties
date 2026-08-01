"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { initCtaTracking } from "@/lib/track/client/cta";
import { initErrorTracking } from "@/lib/track/client/errors";
import { initFormTracking } from "@/lib/track/client/forms";
import { initMouseTracking } from "@/lib/track/client/mouse";
import { initReplayCapture } from "@/lib/track/client/replay";
import { initScrollTracking } from "@/lib/track/client/scroll";
import { initWebVitals } from "@/lib/track/client/vitals";
import { track } from "@/lib/track/client/queue";
import { initQueue } from "@/lib/track/client/queue";

/**
 * Mounted once in the root layout. Skips /admin entirely — that's the
 * operator's own panel, not a visitor page to record.
 */
export function Tracker() {
  const pathname = usePathname();
  const enteredAtRef = useRef<number>(0);
  const initializedRef = useRef(false);
  const isAdmin = pathname?.startsWith("/admin");

  useEffect(() => {
    if (isAdmin || initializedRef.current) return;
    initializedRef.current = true;

    function finalizePageView() {
      const enteredAt = enteredAtRef.current;
      track.pageView({
        path: window.location.pathname,
        title: document.title,
        enteredAt,
        exitedAt: Date.now(),
        timeOnPage: Date.now() - enteredAt,
      });
    }

    // Registered before initQueue()'s own listeners so the finalized page
    // view is enqueued before the queue flushes on the same hide/pagehide event.
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") finalizePageView();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", finalizePageView);

    initQueue();
    initScrollTracking();
    initCtaTracking();
    initFormTracking();
    initWebVitals();
    initErrorTracking();
    initMouseTracking();
    initReplayCapture();

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", finalizePageView);
    };
  }, [isAdmin]);

  useEffect(() => {
    enteredAtRef.current = Date.now();
  }, [pathname]);

  return null;
}
