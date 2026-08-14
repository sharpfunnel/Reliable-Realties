"use client";

import { useId, useMemo, useState } from "react";

import { formatCurrency, formatCurrencyCompact } from "@/lib/admin/format";

type Point = { date: string; spend: number; leads: number };

const WIDTH = 720;
const PAD_LEFT = 46;
const PAD_RIGHT = 12;
const PAD_TOP = 22;
const SPEND_H = 116;
const GAP = 36;
const LEADS_H = 64;
const AXIS_H = 18;
const HEIGHT = PAD_TOP + SPEND_H + GAP + LEADS_H + AXIS_H;

const SPEND_TOP = PAD_TOP;
const SPEND_BOTTOM = PAD_TOP + SPEND_H;
const LEADS_TOP = SPEND_BOTTOM + GAP;
const LEADS_BOTTOM = LEADS_TOP + LEADS_H;

const SPEND_COLOR = "#b68a5e";
const LEADS_COLOR = "#121820";

function formatDay(iso: string) {
  const [, month, day] = iso.split("-");
  const name = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
    Number(month) - 1
  ];
  return `${Number(day)} ${name ?? ""}`.trim();
}

/**
 * Spend and leads as two stacked panels rather than one chart with two y-axes.
 *
 * A dual-axis chart would let the two scales be chosen to imply any correlation
 * we like — the classic way to make a spend line "explain" a leads line. Small
 * multiples keep each series on an honest scale of its own while a shared
 * x-axis and crosshair still let you read one day across both.
 */
export function SpendChart({ data, currency = "INR" }: { data: Point[]; currency?: string }) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { maxSpend, maxLeads } = useMemo(
    () => ({
      maxSpend: Math.max(1, ...data.map((d) => d.spend)),
      maxLeads: Math.max(1, ...data.map((d) => d.leads)),
    }),
    [data],
  );

  if (data.length === 0) {
    return <div className="grid h-55 place-items-center text-sm text-slate-400">No spend data yet.</div>;
  }

  const stepX = (WIDTH - PAD_LEFT - PAD_RIGHT) / Math.max(1, data.length - 1);
  const scaleX = (index: number) => PAD_LEFT + index * stepX;
  const scaleY = (value: number, max: number, top: number, bottom: number) =>
    bottom - (value / max) * (bottom - top);

  const spendY = (value: number) => scaleY(value, maxSpend, SPEND_TOP, SPEND_BOTTOM);
  const leadsY = (value: number) => scaleY(value, maxLeads, LEADS_TOP, LEADS_BOTTOM);

  const spendLine = data.map((d, i) => `${i === 0 ? "M" : "L"}${scaleX(i)},${spendY(d.spend)}`).join(" ");
  const spendArea = `${spendLine} L${scaleX(data.length - 1)},${SPEND_BOTTOM} L${scaleX(0)},${SPEND_BOTTOM} Z`;
  const leadsLine = data.map((d, i) => `${i === 0 ? "M" : "L"}${scaleX(i)},${leadsY(d.leads)}`).join(" ");

  const labelIndexes = [0, Math.floor((data.length - 1) / 2), data.length - 1].filter(
    (v, i, arr) => arr.indexOf(v) === i,
  );

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`Daily ad spend and leads over the last ${data.length} days`}
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relativeX = ((e.clientX - rect.left) / rect.width) * WIDTH;
          const index = Math.round((relativeX - PAD_LEFT) / stepX);
          setHoverIndex(Math.min(Math.max(index, 0), data.length - 1));
        }}
      >
        <defs>
          <linearGradient id={`${gradientId}-spend`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SPEND_COLOR} stopOpacity={0.35} />
            <stop offset="100%" stopColor={SPEND_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Spend panel */}
        <text x={PAD_LEFT} y={12} fontSize={11} fontWeight={600} fill="#334155">
          Spend
        </text>
        <text x={PAD_LEFT - 8} y={SPEND_TOP + 4} fontSize={10} fill="#94a3b8" textAnchor="end">
          {formatCurrencyCompact(maxSpend, currency)}
        </text>
        <text x={PAD_LEFT - 8} y={SPEND_BOTTOM + 3} fontSize={10} fill="#94a3b8" textAnchor="end">
          0
        </text>
        <line x1={PAD_LEFT} y1={SPEND_BOTTOM} x2={WIDTH - PAD_RIGHT} y2={SPEND_BOTTOM} stroke="#e2e8f0" />
        <path d={spendArea} fill={`url(#${gradientId}-spend)`} stroke="none" />
        <path d={spendLine} fill="none" stroke={SPEND_COLOR} strokeWidth={2} />

        {/* Leads panel */}
        <text x={PAD_LEFT} y={LEADS_TOP - 10} fontSize={11} fontWeight={600} fill="#334155">
          Leads
        </text>
        <text x={PAD_LEFT - 8} y={LEADS_TOP + 4} fontSize={10} fill="#94a3b8" textAnchor="end">
          {maxLeads}
        </text>
        <text x={PAD_LEFT - 8} y={LEADS_BOTTOM + 3} fontSize={10} fill="#94a3b8" textAnchor="end">
          0
        </text>
        <line x1={PAD_LEFT} y1={LEADS_BOTTOM} x2={WIDTH - PAD_RIGHT} y2={LEADS_BOTTOM} stroke="#e2e8f0" />
        <path d={leadsLine} fill="none" stroke={LEADS_COLOR} strokeWidth={2} />

        {/* Shared x-axis labels */}
        {labelIndexes.map((i) => (
          <text
            key={i}
            x={scaleX(i)}
            y={LEADS_BOTTOM + 14}
            fontSize={10}
            fill="#94a3b8"
            textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
          >
            {formatDay(data[i].date)}
          </text>
        ))}

        {hoverIndex !== null ? (
          <>
            <line
              x1={scaleX(hoverIndex)}
              y1={SPEND_TOP}
              x2={scaleX(hoverIndex)}
              y2={SPEND_BOTTOM}
              stroke="#cbd5e1"
              strokeDasharray="3 3"
            />
            <line
              x1={scaleX(hoverIndex)}
              y1={LEADS_TOP}
              x2={scaleX(hoverIndex)}
              y2={LEADS_BOTTOM}
              stroke="#cbd5e1"
              strokeDasharray="3 3"
            />
            <circle cx={scaleX(hoverIndex)} cy={spendY(data[hoverIndex].spend)} r={3.5} fill={SPEND_COLOR} />
            <circle cx={scaleX(hoverIndex)} cy={leadsY(data[hoverIndex].leads)} r={3.5} fill={LEADS_COLOR} />
          </>
        ) : null}
      </svg>

      {hoverIndex !== null ? (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: `${Math.min(Math.max((scaleX(hoverIndex) / WIDTH) * 100, 10), 80)}%` }}
        >
          <div className="mb-1 font-semibold text-slate-800">{data[hoverIndex].date}</div>
          <div className="flex items-center gap-1.5 text-slate-600">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: SPEND_COLOR }} />
            Spend: {formatCurrency(data[hoverIndex].spend, currency)}
          </div>
          <div className="flex items-center gap-1.5 text-slate-600">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: LEADS_COLOR }} />
            Leads: {data[hoverIndex].leads}
          </div>
        </div>
      ) : null}
    </div>
  );
}
