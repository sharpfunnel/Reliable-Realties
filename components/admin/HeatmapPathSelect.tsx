"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

export function HeatmapPathSelect({
  paths,
  path,
  type,
  days,
  device,
}: {
  paths: { path: string; views: number }[];
  path: string;
  type: string;
  days: number;
  device?: string;
}) {
  const router = useRouter();

  return (
    <div className="relative flex items-center rounded-full border border-slate-700 bg-slate-900 text-slate-200 transition-colors hover:border-slate-600">
      <select
        value={path}
        onChange={(e) => {
          const params = new URLSearchParams({ path: e.target.value, type, days: String(days) });
          if (device) params.set("device", device);
          router.push(`/admin/heatmap?${params.toString()}`);
        }}
        className="appearance-none bg-transparent py-1.5 pr-8 pl-3 text-xs font-medium outline-none"
      >
        {paths.map((p) => (
          <option key={p.path} value={p.path} className="bg-slate-900 text-slate-100">
            {p.path} ({p.views.toLocaleString()})
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 size-3.5 text-slate-500" strokeWidth={2} />
    </div>
  );
}
