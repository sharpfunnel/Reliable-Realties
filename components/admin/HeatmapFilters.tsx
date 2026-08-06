"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/cn";
import { HEATMAP_GRADIENT_CSS } from "@/lib/admin/heatColor";

type Common = { path: string; type: string; days: number; device?: string };

function buildHref(overrides: Partial<Common>, base: Common) {
  const merged = { ...base, ...overrides };
  const params = new URLSearchParams({ path: merged.path, type: merged.type, days: String(merged.days) });
  if (merged.device) params.set("device", merged.device);
  return `/admin/heatmap?${params.toString()}`;
}

const DAY_OPTIONS = [
  { value: 7, label: "Last 7 Days" },
  { value: 14, label: "Last 14 Days" },
  { value: 30, label: "Last 30 Days" },
  { value: 90, label: "Last 90 Days" },
];

function DropdownChip({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex items-center rounded-full border border-slate-700 bg-slate-900 text-slate-200 transition-colors hover:border-slate-600">
      {children}
      <ChevronDown className="pointer-events-none absolute right-2.5 size-3.5 text-slate-500" strokeWidth={2} />
    </div>
  );
}

export function HeatmapDateRangeSelect(props: Common) {
  const router = useRouter();
  return (
    <DropdownChip>
      <select
        value={props.days}
        onChange={(e) => router.push(buildHref({ days: Number(e.target.value) }, props))}
        className="appearance-none bg-transparent py-1.5 pr-8 pl-3 text-xs font-medium outline-none"
      >
        {DAY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-100">
            {opt.label}
          </option>
        ))}
      </select>
    </DropdownChip>
  );
}

const DEVICE_OPTIONS = [
  { value: "", label: "All devices" },
  { value: "desktop", label: "Desktop" },
  { value: "tablet", label: "Tablet" },
  { value: "mobile", label: "Mobile" },
];

export function HeatmapDeviceTabs(props: Common) {
  const router = useRouter();
  return (
    <DropdownChip>
      <select
        value={props.device ?? ""}
        onChange={(e) => router.push(buildHref({ device: e.target.value || undefined }, props))}
        className="appearance-none bg-transparent py-1.5 pr-8 pl-3 text-xs font-medium outline-none"
      >
        {DEVICE_OPTIONS.map((opt) => (
          <option key={opt.label} value={opt.value} className="bg-slate-900 text-slate-100">
            {opt.label}
          </option>
        ))}
      </select>
    </DropdownChip>
  );
}

const TYPE_OPTIONS = [
  { value: "click", label: "Click Heatmap" },
  { value: "scroll", label: "Scroll Heatmap" },
  { value: "hover", label: "Hover Heatmap" },
] as const;

export function HeatmapTypeTabs(props: Common) {
  return (
    <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
      {TYPE_OPTIONS.map((opt) => {
        const active = opt.value === props.type;
        return (
          <Link
            key={opt.value}
            href={buildHref({ type: opt.value }, props)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              active ? "border border-white/20 bg-white/10 text-white" : "text-slate-500 hover:text-slate-300",
            )}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}

export function HeatmapLegend() {
  return (
    <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
      <span>Low</span>
      <span className="h-2 w-28 rounded-full" style={{ background: HEATMAP_GRADIENT_CSS }} />
      <span>Highest</span>
    </div>
  );
}
