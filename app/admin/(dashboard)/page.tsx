import { Users, Activity, Target, Percent, ArrowDownWideNarrow, MousePointerClick, Clock } from "lucide-react";

import { PageHeader } from "@/components/admin/PageHeader";
import { StatTile } from "@/components/admin/StatTile";
import { ConversionFunnel } from "@/components/admin/ConversionFunnel";
import { TimeSeriesChart } from "@/components/admin/TimeSeriesChart";
import { Table, Thead, Th, Tr, Td, EmptyState } from "@/components/admin/Table";
import {
  getOverviewStats,
  getDailyTimeSeries,
  getTrafficSources,
  getRecentLeads,
  getFunnelStats,
} from "@/lib/admin/queries";

function formatDuration(seconds: number) {
  if (!seconds) return "0s";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default async function AdminOverviewPage() {
  const [stats, series, sources, recentLeads, funnel] = await Promise.all([
    getOverviewStats(30),
    getDailyTimeSeries(30),
    getTrafficSources(30),
    getRecentLeads(8),
    getFunnelStats(30, "all"),
  ]);

  return (
    <>
      <PageHeader title="Overview" description="Last 30 days" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <StatTile icon={Users} label="Visitors" value={stats.visitors.toLocaleString()} />
        <StatTile icon={Activity} label="Sessions" value={stats.sessions.toLocaleString()} />
        <StatTile icon={Target} label="Leads" value={stats.leads.toLocaleString()} />
        <StatTile icon={Percent} label="Conversion" value={`${stats.conversionRate.toFixed(1)}%`} />
        <StatTile icon={ArrowDownWideNarrow} label="Scrolled 50%+" value={stats.scrollersCount.toLocaleString()} />
        <StatTile icon={MousePointerClick} label="CTA Clicks" value={stats.ctaClicks.toLocaleString()} />
        <StatTile icon={Clock} label="Avg Time" value={formatDuration(stats.avgSessionDuration)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Traffic &amp; conversions</h2>
          <TimeSeriesChart data={series} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Conversion funnel</h2>
          <ConversionFunnel stages={funnel.stages} />
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Traffic sources</h2>
          <Table>
            <Thead>
              <Tr>
                <Th>Source</Th>
                <Th>Medium</Th>
                <Th>Campaign</Th>
                <Th className="text-right">Sessions</Th>
                <Th className="text-right">Leads</Th>
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
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Recent leads</h2>
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
      </div>
    </>
  );
}
