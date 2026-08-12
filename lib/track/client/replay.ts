"use client";

import { getSessionId } from "@/lib/track/client/ids";

const FLUSH_INTERVAL_MS = 10000;
const FLUSH_SIZE_THRESHOLD = 200;
const MAX_BUFFERED_EVENTS = 1000;
const REPLAY_ENDPOINT = "/api/replay";

export async function initReplayCapture() {
  const { record } = await import("rrweb");

  let buffer: unknown[] = [];

  function requeue(pending: unknown[]) {
    // Keep pending (older) events before newly captured ones to preserve rrweb's event order.
    buffer = [...pending, ...buffer].slice(-MAX_BUFFERED_EVENTS);
  }

  function send(sync = false) {
    if (buffer.length === 0) return;
    const [clientId] = getSessionId();
    const pending = buffer;
    buffer = [];
    const body = JSON.stringify({ clientId, events: pending });

    if (sync && "sendBeacon" in navigator) {
      // sendBeacon gives no delivery feedback, so a batch lost here can't be retried.
      navigator.sendBeacon(REPLAY_ENDPOINT, new Blob([body], { type: "application/json" }));
      return;
    }
    fetch(REPLAY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: sync,
    })
      .then((res) => {
        if (!res.ok) requeue(pending);
      })
      .catch(() => requeue(pending));
  }

  const stopRecording = record({
    emit(event) {
      buffer.push(event);
      if (buffer.length >= FLUSH_SIZE_THRESHOLD) send(false);
    },
    maskAllInputs: true,
    maskInputOptions: { password: true },
    sampling: {
      scroll: 200,
      media: 800,
      input: "last",
    },
  });

  const flushTimer = setInterval(() => send(false), FLUSH_INTERVAL_MS);

  function onHide() {
    if (document.visibilityState === "hidden") send(true);
  }
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", () => send(true));

  return () => {
    stopRecording?.();
    clearInterval(flushTimer);
    document.removeEventListener("visibilitychange", onHide);
  };
}
