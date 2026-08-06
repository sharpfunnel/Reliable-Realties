import Link from "next/link";
import { RotateCcw } from "lucide-react";

import { cn } from "@/lib/cn";

const OPTIONS = [
  { value: 7, label: "7D" },
  { value: 14, label: "14D" },
  { value: 30, label: "30D" },
  { value: 90, label: "90D" },
];

const DEFAULT_DAYS = 30;

export function DateRangeSelect({ days }: { days: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-1 rounded-full bg-slate-100 p-1">
        {OPTIONS.map((opt) => (
          <Link
            key={opt.value}
            href={opt.value === DEFAULT_DAYS ? "/admin" : `/admin?days=${opt.value}`}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              days === opt.value ? "bg-ink text-white" : "text-slate-600 hover:bg-slate-200",
            )}
          >
            {opt.label}
          </Link>
        ))}
      </div>
      <Link
        href="/admin"
        className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        <RotateCcw className="size-3.5" strokeWidth={1.75} />
        Reset
      </Link>
    </div>
  );
}
