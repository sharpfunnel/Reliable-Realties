import Link from "next/link";
import {
  Users,
  Activity,
  Target,
  Percent,
  ArrowDownWideNarrow,
  MousePointerClick,
  Clock,
  LogOut,
  Repeat,
  UserPlus,
} from "lucide-react";

import { PageHeader } from "@/components/admin/PageHeader";
import { StatTile } from "@/components/admin/StatTile";
import { DateRangeSelect } from "@/components/admin/DateRangeSelect";
import { LiveBadge } from "@/components/admin/LiveBadge";
import { ConversionFunnel } from "@/components/admin/ConversionFunnel";
import { TimeSeriesChart } from "@/components/admin/TimeSeriesChart";
import { DevicesDonut } from "@/components/admin/DevicesDonut";
import { BarList } from "@/components/admin/BarList";
import { WorldMap } from "@/components/admin/WorldMap";
import { CountryList } from "@/components/admin/CountryList";
import { Table, Thead, Th, Tr, Td, EmptyState } from "@/components/admin/Table";
import {
  getOverviewStats,
  getDailyTimeSeries,
  getTrafficSources,
  getRecentLeads,
  getFunnelStats,
  getLiveVisitorCount,
  getDeviceBreakdown,
  getBrowserBreakdown,
  getTopPages,
  getVisitorsByCountry,
} from "@/lib/admin/queries";

const ALLOWED_RANGES = [7, 14, 30, 90];

function formatDuration(seconds: number) {
  if (!seconds) return "0s";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: rawDays } = await searchParams;
  const parsedDays = Number(rawDays);
  const days = ALLOWED_RANGES.includes(parsedDays) ? parsedDays : 30;

  const [stats, series, sources, recentLeads, funnel, liveCount, devices, browsers, topPages, countries] =
    await Promise.all([
      getOverviewStats(days),
      getDailyTimeSeries(days),
      getTrafficSources(days),
      getRecentLeads(10),
      getFunnelStats(days, "all"),
      getLiveVisitorCount(),
      getDeviceBreakdown(days),
      getBrowserBreakdown(days),
      getTopPages(days),
      getVisitorsByCountry(days),
    ]);

  const { current, deltas } = stats;

  return (
    <>
      <PageHeader
        title="Overview"
        description="Everything happening on the landing page, in real time."
        actions={<DateRangeSelect days={days} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile icon={Users} label="Total Visitors" value={current.visitors.toLocaleString()} delta={deltas.visitors} />
        <StatTile icon={Activity} label="Total Sessions" value={current.sessions.toLocaleString()} delta={deltas.sessions} />
        <StatTile icon={Target} label="Total Leads" value={current.leads.toLocaleString()} delta={deltas.leads} />
        <StatTile
          icon={Percent}
          label="Conversion Rate"
          value={`${current.conversionRate.toFixed(1)}%`}
          delta={deltas.conversionRate}
        />
        <StatTile
          icon={ArrowDownWideNarrow}
          label="Scroll Depth (50%+)"
          value={current.scrollersCount.toLocaleString()}
          delta={deltas.scrollersCount}
        />
        <StatTile
          icon={MousePointerClick}
          label="CTA Clicks"
          value={current.ctaClicks.toLocaleString()}
          delta={deltas.ctaClicks}
        />
        <StatTile
          icon={Clock}
          label="Avg. Session Duration"
          value={formatDuration(current.avgSessionDuration)}
          delta={deltas.avgSessionDuration}
        />
        <StatTile
          icon={LogOut}
          label="Bounce Rate"
          value={`${current.bounceRate.toFixed(1)}%`}
          delta={deltas.bounceRate}
        />
        <StatTile
          icon={Repeat}
          label="Returning Visitors"
          value={current.returningVisitors.toLocaleString()}
          delta={deltas.returningVisitors}
        />
        <StatTile
          icon={UserPlus}
          label="New Visitors"
          value={current.newVisitors.toLocaleString()}
          delta={deltas.newVisitors}
        />
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Visitors, sessions &amp; leads</h2>
            <p className="mt-0.5 text-xs text-slate-400">Drag the handles beneath the chart to zoom into a period.</p>
          </div>
          <LiveBadge initialCount={liveCount} />
        </div>
        <TimeSeriesChart key={days} data={series} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Traffic sources</h2>
          <Table>
            <Thead>
              <Tr>
                <Th>Source</Th>
                <Th>Medium</Th>
                <Th>Campaign</Th>
                <Th className="text-right">Sessions</Th>
                <Th className="text-right">Leads</Th>
                <Th className="text-right">Conv.</Th>
              </Tr>
            </Thead>
            <tbody>
              {sources.length === 0 ? (
                <EmptyState />
              ) : (
                sources.slice(0, 10).map((row, i) => (
                  <Tr key={i}>
                    <Td className="font-medium text-slate-800">{row.source}</Td>
                    <Td>{row.medium}</Td>
                    <Td>{row.campaign}</Td>
                    <Td className="text-right">{row.sessions}</Td>
                    <Td className="text-right">{row.leads}</Td>
                    <Td className="text-right">{row.conversionRate.toFixed(1)}%</Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Conversion funnel</h2>
          <ConversionFunnel stages={funnel.stages} />
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Devices</h2>
          <p className="mb-4 -mt-3 text-xs text-slate-400">Share of sessions by device type.</p>
          <DevicesDonut data={devices} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Browsers</h2>
          <p className="mb-4 -mt-3 text-xs text-slate-400">Sessions by browser.</p>
          <BarList items={browsers.map((b) => ({ label: b.browser, value: b.count }))} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Top pages</h2>
          <p className="mb-4 -mt-3 text-xs text-slate-400">Views, dwell time and conversions.</p>
          <Table>
            <Thead>
              <Tr>
                <Th>Page</Th>
                <Th className="text-right">Views</Th>
                <Th className="text-right">Avg time</Th>
                <Th className="text-right">Bounce</Th>
                <Th className="text-right">Conv.</Th>
              </Tr>
            </Thead>
            <tbody>
              {topPages.length === 0 ? (
                <EmptyState />
              ) : (
                topPages.map((page) => (
                  <Tr key={page.path}>
                    <Td className="font-medium text-slate-800">{page.path}</Td>
                    <Td className="text-right">{page.views}</Td>
                    <Td className="text-right">{formatDuration(page.avgTimeOnPage)}</Td>
                    <Td className="text-right">{page.bounceRate.toFixed(0)}%</Td>
                    <Td className="text-right">{page.conversions}</Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">Visitors by country</h2>
          <p className="mb-3 text-xs text-slate-400">Hover a marker to see visitors and leads.</p>
          <WorldMap data={countries} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Top countries</h2>
          <CountryList data={countries} />
        </section>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Recent leads</h2>
          <Link href="/admin/leads" className="text-xs font-medium text-gold hover:underline">
            View all leads
          </Link>
        </div>
        <Table>
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Contact</Th>
              <Th>Status</Th>
              <Th>Received</Th>
            </Tr>
          </Thead>
          <tbody>
            {recentLeads.length === 0 ? (
              <EmptyState />
            ) : (
              recentLeads.map((lead) => (
                <Tr key={lead.id}>
                  <Td className="font-medium text-slate-800">{lead.name ?? "—"}</Td>
                  <Td>{lead.phone ?? lead.email ?? "—"}</Td>
                  <Td className="capitalize">{lead.status}</Td>
                  <Td>{lead.createdAt.toLocaleString()}</Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </section>
    </>
  );
}
