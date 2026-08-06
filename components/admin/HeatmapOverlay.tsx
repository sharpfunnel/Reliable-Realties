"use client";

import { useEffect, useRef, useState } from "react";

import { HEATMAP_COLOR_STOPS } from "@/lib/admin/heatColor";

type Point = { xPct: number; yPct: number };

export type Hotspot = {
  selector: string;
  label: string;
  x: number;
  y: number;
  count: number;
  visitors: number;
  conversionPct?: number;
};

const FALLBACK_HEIGHT = 720;

let cachedLut: Uint8ClampedArray | null = null;

function getColorLut(): Uint8ClampedArray {
  if (cachedLut) return cachedLut;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new Uint8ClampedArray(256 * 4);
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  for (const [stop, color] of HEATMAP_COLOR_STOPS) gradient.addColorStop(stop, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1, 256);
  cachedLut = ctx.getImageData(0, 0, 1, 256).data;
  return cachedLut;
}

function drawDensity(canvas: HTMLCanvasElement, points: Point[], width: number, height: number, type: "click" | "hover") {
  if (width === 0 || height === 0) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (points.length === 0) return;

  const alphaCanvas = document.createElement("canvas");
  alphaCanvas.width = canvas.width;
  alphaCanvas.height = canvas.height;
  const alphaCtx = alphaCanvas.getContext("2d");
  if (!alphaCtx) return;

  const radius = (type === "click" ? Math.max(16, Math.min(width, height) * 0.02) : Math.max(26, Math.min(width, height) * 0.04)) * dpr;
  const peakAlpha = type === "click" ? 0.3 : 0.16;

  for (const p of points) {
    const x = (p.xPct / 100) * canvas.width;
    const y = (p.yPct / 100) * canvas.height;
    const gradient = alphaCtx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(0,0,0,${peakAlpha})`);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    alphaCtx.fillStyle = gradient;
    alphaCtx.beginPath();
    alphaCtx.arc(x, y, radius, 0, Math.PI * 2);
    alphaCtx.fill();
  }

  const alphaData = alphaCtx.getImageData(0, 0, canvas.width, canvas.height);
  const lut = getColorLut();
  const out = ctx.createImageData(canvas.width, canvas.height);

  for (let i = 0; i < alphaData.data.length; i += 4) {
    const alpha = alphaData.data[i + 3];
    if (alpha === 0) continue;
    const lutIndex = Math.min(255, alpha) * 4;
    out.data[i] = lut[lutIndex];
    out.data[i + 1] = lut[lutIndex + 1];
    out.data[i + 2] = lut[lutIndex + 2];
    out.data[i + 3] = Math.min(235, alpha + 70);
  }

  ctx.putImageData(out, 0, 0);
}

export function HeatmapOverlay({
  path,
  points,
  type,
  hotspots = [],
}: {
  path: string;
  points: Point[];
  type: "click" | "hover";
  hotspots?: Hotspot[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [activeHotspot, setActiveHotspot] = useState<number | null>(null);

  // Track the container's width (for canvas sizing) — its height is irrelevant now
  // that the inner layer scrolls the outer container instead of being clipped by it.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The tracked xPct/yPct are stored as a fraction of the *full page height*
  // (see lib/track/client/mouse.ts `pagePct`), so the overlay only lines up if it's
  // drawn at that same full height — not the visible viewport. We read the embedded
  // page's real scrollHeight (same-origin) and size the iframe + canvas to match, then
  // let the outer container scroll to reveal it, instead of scrolling the iframe
  // internally (which used to leave the overlay behind, static, since it never knew
  // the iframe had scrolled).
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let docObserver: ResizeObserver | null = null;

    function measure() {
      try {
        const root = iframe?.contentDocument?.documentElement;
        if (!root) return;
        setContentHeight(root.scrollHeight);
        if (!docObserver) {
          docObserver = new ResizeObserver(() => setContentHeight(root.scrollHeight));
          docObserver.observe(root);
        }
      } catch {
        // not same-origin or not loaded yet — keep the fallback height
      }
    }

    iframe.addEventListener("load", measure);
    measure();
    return () => {
      iframe.removeEventListener("load", measure);
      docObserver?.disconnect();
    };
  }, [path]);

  const height = contentHeight || FALLBACK_HEIGHT;

  useEffect(() => {
    if (!canvasRef.current) return;
    drawDensity(canvasRef.current, points, containerWidth, height, type);
  }, [points, containerWidth, height, type]);

  const maxCount = Math.max(1, ...hotspots.map((h) => h.count));
  const active = activeHotspot !== null ? hotspots[activeHotspot] : null;

  return (
    <div
      ref={containerRef}
      className="relative max-h-180 w-full overflow-y-auto overflow-x-hidden rounded-xl border border-slate-800 bg-slate-800"
    >
      <div className="relative w-full" style={{ height }}>
        <iframe
          ref={iframeRef}
          key={path}
          src={path}
          title="Heatmap target page"
          className="pointer-events-none absolute inset-0 h-full w-full border-0 grayscale-35 opacity-95"
        />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

        {hotspots.map((h, i) => {
          const markerSize = 14 + (h.count / maxCount) * 18;
          return (
            <button
              key={h.selector}
              type="button"
              onMouseEnter={() => setActiveHotspot(i)}
              onFocus={() => setActiveHotspot(i)}
              onMouseLeave={() => setActiveHotspot((cur) => (cur === i ? null : cur))}
              onBlur={() => setActiveHotspot((cur) => (cur === i ? null : cur))}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full outline-none"
              style={{
                left: `${h.x}%`,
                top: `${h.y}%`,
                width: markerSize,
                height: markerSize,
                boxShadow: activeHotspot === i ? "0 0 0 3px rgba(255,255,255,0.35)" : undefined,
              }}
              aria-label={h.label}
            />
          );
        })}

        {active ? (
          <div
            className="pointer-events-none absolute z-10 w-56 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-lg border border-slate-700 bg-slate-900/95 p-3 text-xs shadow-xl backdrop-blur-sm"
            style={{ left: `${active.x}%`, top: `${active.y}%` }}
          >
            <div className="mb-2 truncate font-semibold text-slate-100" title={active.label}>
              {active.label}
            </div>
            <dl className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">{type === "click" ? "Clicks" : "Hovers"}</dt>
                <dd className="font-semibold text-slate-100">{active.count.toLocaleString()}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">Unique visitors</dt>
                <dd className="font-semibold text-slate-100">{active.visitors.toLocaleString()}</dd>
              </div>
              {active.conversionPct !== undefined ? (
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Conversion</dt>
                  <dd className="font-semibold text-slate-100">{active.conversionPct.toFixed(1)}%</dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}

        {points.length === 0 ? (
          <div className="absolute inset-0 grid place-items-center bg-slate-900/70 text-sm text-slate-400">
            No {type} interactions recorded yet for this view.
          </div>
        ) : null}
      </div>
    </div>
  );
}
