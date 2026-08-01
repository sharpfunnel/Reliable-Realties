"use client";

import { useMemo, useState } from "react";

type Point = { date: string; visitors: number; sessions: number; leads: number };

const SERIES = [
  { key: "visitors" as const, color: "#94a3b8", label: "Visitors" },
  { key: "sessions" as const, color: "#b68a5e", label: "Sessions" },
  { key: "leads" as const, color: "#121820", label: "Leads" },
];

const WIDTH = 720;
const HEIGHT = 220;
const PADDING = 24;

export function TimeSeriesChart({ data }: { data: Point[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const max = useMemo(() => {
    const values = data.flatMap((d) => [d.visitors, d.sessions, d.leads]);
    return Math.max(1, ...values);
  }, [data]);

  if (data.length === 0) {
    return <div className="grid h-[220px] place-items-center text-sm text-slate-400">No data yet.</div>;
  }

  const stepX = (WIDTH - PADDING * 2) / Math.max(1, data.length - 1);
  const scaleY = (value: number) => HEIGHT - PADDING - (value / max) * (HEIGHT - PADDING * 2);
  const scaleX = (index: number) => PADDING + index * stepX;

  const path = (key: "visitors" | "sessions" | "leads") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${scaleX(i)},${scaleY(d[key])}`).join(" ");

  return (
    <div className="relative">
      <div className="mb-3 flex gap-4">
        {SERIES.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relativeX = ((e.clientX - rect.left) / rect.width) * WIDTH;
          const index = Math.round((relativeX - PADDING) / stepX);
          setHoverIndex(Math.min(Math.max(index, 0), data.length - 1));
        }}
      >
        <line x1={PADDING} y1={HEIGHT - PADDING} x2={WIDTH - PADDING} y2={HEIGHT - PADDING} stroke="#e2e8f0" />
        {SERIES.map((s) => (
          <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth={2} />
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
            {SERIES.map((s) => (
              <circle
                key={s.key}
                cx={scaleX(hoverIndex)}
                cy={scaleY(data[hoverIndex][s.key])}
                r={3.5}
                fill={s.color}
              />
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
          <div className="mb-1 font-semibold text-slate-800">{data[hoverIndex].date}</div>
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-slate-600">
              <span className="size-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}: {data[hoverIndex][s.key]}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
