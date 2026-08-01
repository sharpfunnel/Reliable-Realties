import { PageHeader } from "@/components/admin/PageHeader";
import { getPerformanceStats } from "@/lib/admin/queries";

const UNITS: Record<string, string> = {
  LCP: "ms",
  INP: "ms",
  CLS: "",
  FCP: "ms",
  TTFB: "ms",
};

function formatValue(metric: string, value: number) {
  if (metric === "CLS") return value.toFixed(3);
  return `${Math.round(value)}${UNITS[metric]}`;
}

export default async function AdminPerformancePage() {
  const stats = await getPerformanceStats(30);

  return (
    <>
      <PageHeader title="Performance" description="Core Web Vitals, last 30 days" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((row) => {
          const total = row.good + row.needsImprovement + row.poor || 1;
          return (
            <div key={row.metric} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-slate-800">{row.metric}</span>
                <span className="text-xs text-slate-400">{row.sampleCount} samples</span>
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">
                {row.sampleCount > 0 ? formatValue(row.metric, row.avg) : "—"}
              </div>

              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="bg-emerald-500" style={{ width: `${(row.good / total) * 100}%` }} />
                <div className="bg-amber-400" style={{ width: `${(row.needsImprovement / total) * 100}%` }} />
                <div className="bg-red-400" style={{ width: `${(row.poor / total) * 100}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-slate-500">
                <span>Good {row.good}</span>
                <span>Needs work {row.needsImprovement}</span>
                <span>Poor {row.poor}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
