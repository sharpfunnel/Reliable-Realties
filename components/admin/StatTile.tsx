import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { cn } from "@/lib/cn";

export function StatTile({
  icon: Icon,
  label,
  value,
  subLabel,
  delta,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subLabel?: string;
  /** Percent change vs. the previous period. `null`/`undefined` hides the badge. */
  delta?: number | null;
}) {
  const hasDelta = delta !== undefined && delta !== null;
  const isPositive = hasDelta && delta >= 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="grid size-8 place-items-center rounded-lg bg-gold/10 text-gold">
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
        {hasDelta ? (
          <span
            className={cn(
              "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
              isPositive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500",
            )}
          >
            {isPositive ? <ArrowUp className="size-3" strokeWidth={2.5} /> : <ArrowDown className="size-3" strokeWidth={2.5} />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        ) : null}
      </div>
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-slate-900">{value}</span>
          {subLabel ? <span className="text-xs text-slate-400">{subLabel}</span> : null}
        </div>
      </div>
    </div>
  );
}
