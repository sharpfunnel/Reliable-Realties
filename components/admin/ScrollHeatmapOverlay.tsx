"use client";

import { useEffect, useRef, useState } from "react";

import { heatColor } from "@/lib/admin/heatColor";

type Decile = { depth: number; reached: number; pct: number };

const FALLBACK_HEIGHT = 720;

export function ScrollHeatmapOverlay({
  path,
  deciles,
  totalSessions,
}: {
  path: string;
  deciles: Decile[];
  totalSessions: number;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  // Scroll depth is a fraction of the full page height, so the gradient and decile
  // lines below only line up if this layer is drawn at that same full height and the
  // *outer* container scrolls to reveal it — an internally-scrolling iframe would move
  // its content while these percentage-positioned overlays stayed put.
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
  const stops = [{ depth: 0, pct: 100 }, ...deciles];
  const gradient = `linear-gradient(to bottom, ${stops.map((s) => `${heatColor(s.pct / 100)} ${s.depth}%`).join(", ")})`;

  return (
    <div className="relative max-h-180 w-full overflow-y-auto overflow-x-hidden rounded-xl border border-slate-800 bg-slate-800">
      <div className="relative w-full" style={{ height }}>
        <iframe
          ref={iframeRef}
          key={path}
          src={path}
          title="Heatmap target page"
          className="pointer-events-none absolute inset-0 h-full w-full border-0 grayscale-35 opacity-95"
        />
        <div className="pointer-events-none absolute inset-0 opacity-55" style={{ background: gradient }} />
        <div className="pointer-events-none absolute inset-0">
          {deciles.map((d) => (
            <div
              key={d.depth}
              className="absolute inset-x-0 border-t border-dashed border-white/30"
              style={{ top: `${d.depth}%` }}
            >
              <span className="absolute right-3 -translate-y-1/2 rounded-full border border-slate-700 bg-slate-900/90 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-slate-100 shadow">
                {d.pct.toFixed(0)}% reached {d.depth}%
              </span>
            </div>
          ))}
        </div>
        {totalSessions === 0 ? (
          <div className="absolute inset-0 grid place-items-center bg-slate-900/70 text-sm text-slate-400">
            No scroll data recorded yet for this view.
          </div>
        ) : null}
      </div>
    </div>
  );
}
