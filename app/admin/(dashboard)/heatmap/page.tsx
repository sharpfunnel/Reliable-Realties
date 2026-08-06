import Link from "next/link";
import { RotateCcw } from "lucide-react";

import { HeatmapOverlay } from "@/components/admin/HeatmapOverlay";
import { ScrollHeatmapOverlay } from "@/components/admin/ScrollHeatmapOverlay";
import { HeatmapPathSelect } from "@/components/admin/HeatmapPathSelect";
import { HeatmapDateRangeSelect, HeatmapDeviceTabs, HeatmapTypeTabs, HeatmapLegend } from "@/components/admin/HeatmapFilters";
import { MostClickedList } from "@/components/admin/MostClickedList";
import {
  getHeatmapPaths,
  getHeatmapPoints,
  getHeatmapSummary,
  getInteractionHotspots,
  getScrollDepthProfile,
  type HeatmapDevice,
} from "@/lib/admin/queries";

const DAY_OPTIONS = [7, 14, 30, 90];

export default async function AdminHeatmapPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string; type?: string; days?: string; device?: string }>;
}) {
  const { path: rawPath, type: rawType = "click", days: rawDays, device: rawDevice } = await searchParams;

  const days = DAY_OPTIONS.includes(Number(rawDays)) ? Number(rawDays) : 30;
  const type = rawType === "hover" ? "hover" : rawType === "scroll" ? "scroll" : "click";
  const device: HeatmapDevice | undefined =
    rawDevice === "desktop" || rawDevice === "tablet" || rawDevice === "mobile" ? rawDevice : undefined;

  const paths = await getHeatmapPaths(days);
  const path = paths.some((p) => p.path === rawPath) ? (rawPath as string) : (paths[0]?.path ?? "/");

  const [points, summary, hotspots, scrollProfile] = await Promise.all([
    paths.length > 0 && type !== "scroll" ? getHeatmapPoints(path, type, days, device) : Promise.resolve([]),
    paths.length > 0 && type !== "scroll" ? getHeatmapSummary(path, type, days, device) : Promise.resolve(null),
    paths.length > 0 && type !== "scroll" ? getInteractionHotspots(path, type, days, device) : Promise.resolve([]),
    paths.length > 0 && type === "scroll" ? getScrollDepthProfile(path, days, device) : Promise.resolve(null),
  ]);

  const commonFilterProps = { path, type, days, device };

  return (
    <div className="rounded-2xl bg-slate-950 p-5 text-slate-200 sm:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Heatmap</h1>
        <p className="mt-1 text-sm text-slate-400">
          Where visitors click, hover and stop scrolling — overlaid on the live page.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HeatmapDateRangeSelect {...commonFilterProps} />
        {paths.length > 0 ? (
          <HeatmapPathSelect paths={paths} path={path} type={type} days={days} device={device} />
        ) : (
          <span className="text-sm text-slate-500">No heatmap data yet.</span>
        )}
        <HeatmapDeviceTabs {...commonFilterProps} />
        <div className="ml-auto">
          <Link
            href="/admin/heatmap"
            className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            <RotateCcw className="size-3.5" strokeWidth={1.75} />
            Reset
          </Link>
        </div>
      </div>

      {paths.length > 0 ? (
        <>
          <div className="mb-4">
            <HeatmapTypeTabs {...commonFilterProps} />
          </div>

          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                {type === "click" ? "Click Heatmap" : type === "hover" ? "Hover Heatmap" : "Scroll Heatmap"}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {type === "scroll"
                  ? scrollProfile
                    ? `${scrollProfile.totalSessions.toLocaleString()} sessions in range`
                    : "—"
                  : summary
                    ? `${summary.interactions.toLocaleString()} interactions across ${summary.sessions.toLocaleString()} sessions`
                    : "—"}
              </p>
            </div>
            {type !== "scroll" ? <HeatmapLegend /> : null}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            {type === "scroll" ? (
              <ScrollHeatmapOverlay
                path={path}
                deciles={scrollProfile?.deciles ?? []}
                totalSessions={scrollProfile?.totalSessions ?? 0}
              />
            ) : (
              <HeatmapOverlay path={path} points={points} type={type} hotspots={hotspots} />
            )}

            <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              {type === "scroll" ? (
                <>
                  <div className="mb-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-800 bg-slate-800/60 p-3">
                      <div className="text-2xl font-semibold text-white">
                        {Math.round(scrollProfile?.avgMaxDepth ?? 0)}%
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">Avg. max scroll</div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-800/60 p-3">
                      <div className="text-2xl font-semibold text-white">
                        {Math.round(scrollProfile?.reachedHalfPct ?? 0)}%
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">Reached 50%</div>
                    </div>
                  </div>

                  <h3 className="mb-2 text-sm font-semibold text-slate-100">Scroll reach</h3>
                  <p className="mb-3 text-xs text-slate-500">How deep visitors get.</p>
                  <ol className="flex flex-col gap-1.5">
                    {(scrollProfile?.deciles ?? []).map((d) => (
                      <li
                        key={d.depth}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/60 px-3 py-2 text-xs"
                      >
                        <span className="font-medium text-slate-200">{d.depth}% depth</span>
                        <span className="text-slate-500">
                          {d.reached.toLocaleString()} visitors <span className="font-semibold text-slate-200">{d.pct.toFixed(1)}%</span>
                        </span>
                      </li>
                    ))}
                  </ol>

                  <div className="mt-4 rounded-lg border border-slate-800 bg-slate-800/40 p-3 text-[11px] leading-relaxed text-slate-500">
                    <span className="font-semibold text-slate-300">How to read this: </span>
                    Interaction coordinates are stored as a fraction of page height, so the gradient stays aligned even
                    after content on the page changes. Each row shows the share of sessions that scrolled at least that
                    far down.
                  </div>
                </>
              ) : (
                <>
                  <h3 className="mb-3 text-sm font-semibold text-slate-100">
                    {type === "click" ? "Most clicked elements" : "Most hovered elements"}
                  </h3>
                  <p className="mb-3 text-xs text-slate-500">Ranked by interaction count.</p>
                  <MostClickedList items={hotspots} />
                </>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
