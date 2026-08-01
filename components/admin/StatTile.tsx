import type { LucideIcon } from "lucide-react";

export function StatTile({
  icon: Icon,
  label,
  value,
  subLabel,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
        <Icon className="size-4 text-gold" strokeWidth={1.75} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-slate-900">{value}</span>
        {subLabel ? <span className="text-xs text-slate-400">{subLabel}</span> : null}
      </div>
    </div>
  );
}
