"use client";

import { getDeviceInfo, getSessionInit } from "@/lib/track/client/device";
import { getSessionId, getVisitorId } from "@/lib/track/client/ids";

const FLUSH_INTERVAL_MS = 5000;
const FLUSH_SIZE_THRESHOLD = 20;
const MAX_QUEUED_PER_KEY = 100;
const TRACK_ENDPOINT = "/api/track";

type Batch = {
  pageViews: Record<string, unknown>[];
  events: Record<string, unknown>[];
  scrollEvents: Record<string, unknown>[];
  ctaEvents: Record<string, unknown>[];
  formEvents: Record<string, unknown>[];
  perfMetrics: Record<string, unknown>[];
  errors: Record<string, unknown>[];
  mouseEvents: Record<string, unknown>[];
  heatmapEvents: Record<string, unknown>[];
};

function emptyBatch(): Batch {
  return {
    pageViews: [],
    events: [],
    scrollEvents: [],
    ctaEvents: [],
    formEvents: [],
    perfMetrics: [],
    errors: [],
    mouseEvents: [],
    heatmapEvents: [],
  };
}

let batch = emptyBatch();
let flushTimer: ReturnType<typeof setInterval> | null = null;
let exitPath: string | undefined;

function batchSize() {
  return Object.values(batch).reduce((sum, arr) => sum + arr.length, 0);
}

function requeue(pending: Batch) {
  for (const key of Object.keys(pending) as (keyof Batch)[]) {
    const merged = [...(pending[key] as unknown[]), ...(batch[key] as unknown[])];
    (batch[key] as unknown[]) = merged.slice(-MAX_QUEUED_PER_KEY);
  }
}

function flush(sync = false) {
  if (batchSize() === 0) return;

  const pending = batch;
  batch = emptyBatch();

  const [clientId] = getSessionId();
  const payload = {
    fingerprint: getVisitorId(),
    clientId,
    device: getDeviceInfo(),
    sessionInit: getSessionInit(),
    exitPath,
    endSession: sync,
    ...pending,
  };

  const body = JSON.stringify(payload);

  if (sync && "sendBeacon" in navigator) {
    // sendBeacon gives no delivery feedback, so a batch lost here can't be retried.
    navigator.sendBeacon(TRACK_ENDPOINT, new Blob([body], { type: "application/json" }));
    return;
  }

  fetch(TRACK_ENDPOINT, {
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

export function initQueue() {
  if (flushTimer) return;
  flushTimer = setInterval(() => flush(false), FLUSH_INTERVAL_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      exitPath = window.location.pathname;
      flush(true);
    }
  });
  window.addEventListener("pagehide", () => {
    exitPath = window.location.pathname;
    flush(true);
  });
}

function enqueue<K extends keyof Batch>(key: K, item: Batch[K][number]) {
  batch[key].push(item);
  if (batchSize() >= FLUSH_SIZE_THRESHOLD) flush(false);
}

export const track = {
  pageView: (data: { path: string; title?: string; enteredAt: number; exitedAt?: number; timeOnPage?: number }) =>
    enqueue("pageViews", data),
  event: (name: string, metadata?: Record<string, unknown>) =>
    enqueue("events", { name, metadata, createdAt: Date.now() }),
  scroll: (data: { path: string; depth: number; timeToReach?: number }) =>
    enqueue("scrollEvents", { ...data, createdAt: Date.now() }),
  cta: (data: { ctaId: string; action: string; timeBeforeClick?: number }) =>
    enqueue("ctaEvents", { ...data, createdAt: Date.now() }),
  form: (data: { formId: string; action: string; fieldName?: string; errorMessage?: string }) =>
    enqueue("formEvents", { ...data, createdAt: Date.now() }),
  perf: (data: { path: string; metric: string; value: number; rating: string }) =>
    enqueue("perfMetrics", { ...data, createdAt: Date.now() }),
  error: (data: { type: string; message: string; stack?: string; path?: string }) =>
    enqueue("errors", { ...data, createdAt: Date.now() }),
  mouse: (data: { path: string; type: string; x: number; y: number; targetSelector?: string; hoverDuration?: number }) =>
    enqueue("mouseEvents", { ...data, createdAt: Date.now() }),
  heatmap: (data: {
    path: string;
    type: string;
    xPct: number;
    yPct: number;
    viewportWidth?: number;
    selector?: string;
    text?: string;
  }) => enqueue("heatmapEvents", { ...data, createdAt: Date.now() }),
  flushNow: () => flush(false),
};
