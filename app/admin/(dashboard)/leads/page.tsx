import { Users, CalendarDays, BadgeCheck, Trophy, XCircle, Percent } from "lucide-react";

import { PageHeader } from "@/components/admin/PageHeader";
import { StatTile } from "@/components/admin/StatTile";
import { LeadsWorkspace } from "@/components/admin/leads/LeadsWorkspace";
import { getLeads, getLeadStats, getLeadFilterOptions, resolveLeadsDateRange } from "@/lib/admin/queries";

const PAGE_SIZE = 25;

const RANGE_LABELS: Record<string, string> = {
  today: "Today",
  "7": "Last 7 days",
  "30": "Last 30 days",
  "90": "Last 90 days",
  all: "All time",
};

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    source?: string;
    campaign?: string;
    country?: string;
    device?: string;
    q?: string;
    range?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "all";
  const source = sp.source ?? "all";
  const campaign = sp.campaign ?? "all";
  const country = sp.country ?? "all";
  const device = sp.device ?? "all";
  const q = sp.q ?? "";
  const range = sp.range ?? "30";
  const page = Math.max(1, Number(sp.page) || 1);

  const dateRange = resolveLeadsDateRange(range);

  const [{ rows, total }, stats, filterOptions] = await Promise.all([
    getLeads({
      status,
      source,
      campaign,
      country,
      device,
      q,
      from: dateRange?.from,
      to: dateRange?.to,
      page,
      pageSize: PAGE_SIZE,
    }),
    getLeadStats(dateRange),
    getLeadFilterOptions(),
  ]);

  return (
    <>
      <PageHeader title="Leads" description={`Every enquiry captured from the site — ${RANGE_LABELS[range] ?? "Last 30 days"}`} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile icon={Users} label="Total Leads" value={stats.total.toLocaleString()} />
        <StatTile icon={CalendarDays} label="Today's Leads" value={stats.today.toLocaleString()} />
        <StatTile icon={BadgeCheck} label="Qualified" value={stats.qualified.toLocaleString()} />
        <StatTile icon={Trophy} label="Won" value={stats.won.toLocaleString()} />
        <StatTile icon={XCircle} label="Lost" value={stats.lost.toLocaleString()} />
        <StatTile icon={Percent} label="Conversion Rate" value={`${stats.conversionRate.toFixed(1)}%`} />
      </div>

      <LeadsWorkspace
        rows={rows}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        filters={{ status, source, campaign, country, device, q, range }}
        filterOptions={filterOptions}
      />
    </>
  );
}
