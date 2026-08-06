import { Activity, MousePointerClick, Repeat, Timer, LogOut } from "lucide-react";

import { PageHeader } from "@/components/admin/PageHeader";
import { StatTile } from "@/components/admin/StatTile";
import { SessionsWorkspace } from "@/components/admin/SessionsWorkspace";
import { getSessions, getSessionStats, getSessionFilterOptions } from "@/lib/admin/queries";

function formatDuration(seconds: number) {
  if (!seconds) return "0s";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default async function AdminSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    visitorType?: string;
    country?: string;
    city?: string;
    device?: string;
    browser?: string;
    os?: string;
    source?: string;
    q?: string;
  }>;
}) {
  const sp = await searchParams;
  const range = sp.range ?? "7";
  const visitorType = (sp.visitorType as "new" | "returning" | "all" | undefined) ?? "all";
  const country = sp.country ?? "all";
  const city = sp.city ?? "all";
  const device = sp.device ?? "all";
  const browser = sp.browser ?? "all";
  const os = sp.os ?? "all";
  const source = sp.source ?? "all";
  const q = sp.q ?? "";
  const days = range === "all" ? undefined : Number(range);

  const [rows, stats, filterOptions] = await Promise.all([
    getSessions({ days, visitorType, country, city, device, browser, os, source, q }),
    getSessionStats(days ?? 36500),
    getSessionFilterOptions(),
  ]);

  return (
    <>
      <PageHeader title="Sessions" description="Every visit, with the full technical and behavioural context." />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile icon={Activity} label="Total Sessions" value={stats.total.toLocaleString()} />
        <StatTile icon={MousePointerClick} label="Live Visitors" value={stats.live.toLocaleString()} />
        <StatTile icon={Repeat} label="Returning Visitors" value={stats.returningVisitors.toLocaleString()} />
        <StatTile icon={Timer} label="Average Duration" value={formatDuration(stats.avgDuration)} />
        <StatTile icon={LogOut} label="Bounce Rate" value={`${stats.bounceRate.toFixed(1)}%`} />
      </div>

      <SessionsWorkspace
        rows={rows}
        filters={{ range, visitorType, country, city, device, browser, os, source, q }}
        filterOptions={filterOptions}
      />
    </>
  );
}
