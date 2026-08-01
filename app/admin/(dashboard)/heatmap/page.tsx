import Link from "next/link";

import { PageHeader } from "@/components/admin/PageHeader";
import { HeatmapOverlay } from "@/components/admin/HeatmapOverlay";
import { cn } from "@/lib/cn";
import { getHeatmapPaths, getHeatmapPoints } from "@/lib/admin/queries";

export default async function AdminHeatmapPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string; type?: string }>;
}) {
  const { path: rawPath, type: rawType = "click" } = await searchParams;
  const paths = await getHeatmapPaths();
  const path = rawPath ?? paths[0] ?? "/";
  const type = rawType === "hover" ? "hover" : "click";

  const points = paths.length > 0 ? await getHeatmapPoints(path, type) : [];

  return (
    <>
      <PageHeader title="Heatmap" description="Click and hover density over the live page" />

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap gap-1.5">
          {paths.length === 0 ? (
            <span className="text-sm text-slate-400">No heatmap data yet.</span>
          ) : (
            paths.map((p) => (
              <Link
                key={p}
                href={`/admin/heatmap?path=${encodeURIComponent(p)}&type=${type}`}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  p === path ? "bg-ink text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                {p}
              </Link>
            ))
          )}
        </div>

        {paths.length > 0 ? (
          <div className="flex gap-1.5">
            {(["click", "hover"] as const).map((t) => (
              <Link
                key={t}
                href={`/admin/heatmap?path=${encodeURIComponent(path)}&type=${t}`}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
                  t === type ? "bg-gold text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                {t}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {paths.length > 0 ? <HeatmapOverlay path={path} points={points} /> : null}
    </>
  );
}
