"use client";

import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";

import { track } from "@/lib/track/client/queue";

function report(metric: Metric) {
  track.perf({
    path: window.location.pathname,
    metric: metric.name,
    value: metric.value,
    rating: metric.rating,
  });
}

export function initWebVitals() {
  onLCP(report);
  onINP(report);
  onCLS(report);
  onFCP(report);
  onTTFB(report);
}
