"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type Point = { date: string; visitors: number; sessions: number; leads: number };

const AREA_SERIES = [
  { key: "visitors" as const, color: "#94a3b8", label: "Visitors" },
  { key: "sessions" as const, color: "#b68a5e", label: "Sessions" },
];
const ALL_SERIES = [...AREA_SERIES, { key: "leads" as const, color: "#121820", label: "Leads" }];

const WIDTH = 720;
const HEIGHT = 220;
const PADDING = 24;

/**
 * Callers should pass `key={days}` (or similar) so a date-range change
 * remounts the chart and resets the zoom brush, instead of needing an
 * effect to resync state derived from `data.length`.
 */
export function TimeSeriesChart({ data }: { data: Point[] }) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [brush, setBrush] = useState<[number, number]>(() => [0, Math.max(0, data.length - 1)]);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragHandle = useRef<"start" | "end" | null>(null);

  useEffect(() => {
    function handleMove(e: PointerEvent) {
      if (!dragHandle.current || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
      const index = Math.round(pct * (data.length - 1));
      setBrush(([start, end]) => {
        if (dragHandle.current === "start") return [Math.min(index, end), end];
        return [start, Math.max(index, start)];
      });
    }
    function handleUp() {
      dragHandle.current = null;
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [data.length]);

  const view = useMemo(() => data.slice(brush[0], brush[1] + 1), [data, brush]);

  const max = useMemo(() => {
    const values = view.flatMap((d) => [d.visitors, d.sessions, d.leads]);
    return Math.max(1, ...values);
  }, [view]);

  if (data.length === 0) {
    return <div className="grid h-55 place-items-center text-sm text-slate-400">No data yet.</div>;
  }

  const stepX = (WIDTH - PADDING * 2) / Math.max(1, view.length - 1);
  const scaleY = (value: number) => HEIGHT - PADDING - (value / max) * (HEIGHT - PADDING * 2);
  const scaleX = (index: number) => PADDING + index * stepX;

  const linePath = (key: "visitors" | "sessions" | "leads") =>
    view.map((d, i) => `${i === 0 ? "M" : "L"}${scaleX(i)},${scaleY(d[key])}`).join(" ");

  const areaPath = (key: "visitors" | "sessions") =>
    `${linePath(key)} L${scaleX(view.length - 1)},${HEIGHT - PADDING} L${scaleX(0)},${HEIGHT - PADDING} Z`;

  const isZoomed = brush[0] !== 0 || brush[1] !== data.length - 1;

  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-4">
          {ALL_SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </div>
          ))}
        </div>
        {isZoomed ? (
          <button
            type="button"
            onClick={() => setBrush([0, data.length - 1])}
            className="text-xs font-medium text-gold hover:underline"
          >
            Reset zoom
          </button>
        ) : null}
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relativeX = ((e.clientX - rect.left) / rect.width) * WIDTH;
          const index = Math.round((relativeX - PADDING) / stepX);
          setHoverIndex(Math.min(Math.max(index, 0), view.length - 1));
        }}
      >
        <defs>
          {AREA_SERIES.map((s) => (
            <linearGradient key={s.key} id={`${gradientId}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <line x1={PADDING} y1={HEIGHT - PADDING} x2={WIDTH - PADDING} y2={HEIGHT - PADDING} stroke="#e2e8f0" />
        {AREA_SERIES.map((s) => (
          <path key={`area-${s.key}`} d={areaPath(s.key)} fill={`url(#${gradientId}-${s.key})`} stroke="none" />
        ))}
        {ALL_SERIES.map((s) => (
          <path key={s.key} d={linePath(s.key)} fill="none" stroke={s.color} strokeWidth={2} />
        ))}
        {hoverIndex !== null ? (
          <>
            <line
              x1={scaleX(hoverIndex)}
              y1={PADDING}
              x2={scaleX(hoverIndex)}
              y2={HEIGHT - PADDING}
              stroke="#cbd5e1"
              strokeDasharray="3 3"
            />
            {ALL_SERIES.map((s) => (
              <circle key={s.key} cx={scaleX(hoverIndex)} cy={scaleY(view[hoverIndex][s.key])} r={3.5} fill={s.color} />
            ))}
          </>
        ) : null}
      </svg>
      {hoverIndex !== null ? (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${Math.min(Math.max((scaleX(hoverIndex) / WIDTH) * 100, 10), 85)}%`,
          }}
        >
          <div className="mb-1 font-semibold text-slate-800">{view[hoverIndex].date}</div>
          {ALL_SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-slate-600">
              <span className="size-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}: {view[hoverIndex][s.key]}
            </div>
          ))}
        </div>
      ) : null}

      <p className="mt-3 mb-1.5 text-[11px] text-slate-400">Drag the handles below to zoom into a period.</p>
      <div ref={trackRef} className="relative h-1.5 rounded-full bg-slate-100">
        <div
          className="absolute h-full rounded-full bg-gold/40"
          style={{
            left: `${(brush[0] / Math.max(1, data.length - 1)) * 100}%`,
            right: `${100 - (brush[1] / Math.max(1, data.length - 1)) * 100}%`,
          }}
        />
        <div
          role="slider"
          aria-label="Zoom start"
          aria-valuemin={0}
          aria-valuemax={data.length - 1}
          aria-valuenow={brush[0]}
          aria-valuetext={data[brush[0]]?.date}
          onPointerDown={() => (dragHandle.current = "start")}
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-gold bg-white shadow"
          style={{ left: `${(brush[0] / Math.max(1, data.length - 1)) * 100}%` }}
        />
        <div
          role="slider"
          aria-label="Zoom end"
          aria-valuemin={0}
          aria-valuemax={data.length - 1}
          aria-valuenow={brush[1]}
          aria-valuetext={data[brush[1]]?.date}
          onPointerDown={() => (dragHandle.current = "end")}
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-gold bg-white shadow"
          style={{ left: `${(brush[1] / Math.max(1, data.length - 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}
