"use client";

import { track } from "@/lib/track/client/queue";

/**
 * Reports a caught error into the same pipeline as window-level errors, so it
 * shows up in /admin/errors alongside them. Used where a `catch` would
 * otherwise swallow a failure the visitor only sees as "something went wrong".
 */
export function trackError(type: string, error: unknown) {
  const err = error instanceof Error ? error : undefined;
  const message = (err?.message || String(error ?? "")).slice(0, 500) || "Unknown error";

  track.errorNow({
    type,
    message,
    stack: err?.stack,
    path: window.location.pathname,
  });
}

export function initErrorTracking() {
  function onError(event: ErrorEvent) {
    track.error({
      type: "js",
      message: event.message?.slice(0, 500) || "Unknown error",
      stack: event.error?.stack,
      path: window.location.pathname,
    });
  }

  function onRejection(event: PromiseRejectionEvent) {
    const reason = event.reason;
    track.error({
      type: "unhandled_rejection",
      message: (reason?.message ?? String(reason))?.slice(0, 500),
      stack: reason?.stack,
      path: window.location.pathname,
    });
  }

  function onResourceError(event: Event) {
    const target = event.target;
    if (target instanceof HTMLImageElement) {
      track.error({
        type: "image_load",
        message: `Failed to load image: ${target.src}`,
        path: window.location.pathname,
      });
    }
  }

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  window.addEventListener("error", onResourceError, true);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    window.removeEventListener("error", onResourceError, true);
  };
}
