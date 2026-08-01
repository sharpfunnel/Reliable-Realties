import { Users, Activity, Target, Percent } from "lucide-react";

import { PageHeader } from "@/components/admin/PageHeader";
import { StatTile } from "@/components/admin/StatTile";
import { getReportOverview, resolveReportRange } from "@/lib/admin/reports";

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const range = resolveReportRange({ from, to });
  const overview = await getReportOverview(range);

  const query = `from=${toInputDate(range.from)}&to=${toInputDate(range.to)}`;

  return (
    <>
      <PageHeader title="Reports" description="Date-ranged exports" />

      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="text-xs font-medium text-slate-500">
            From
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={toInputDate(range.from)}
            className="h-9 rounded-lg border border-slate-200 px-2.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="text-xs font-medium text-slate-500">
            To
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={toInputDate(range.to)}
            className="h-9 rounded-lg border border-slate-200 px-2.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="h-9 rounded-lg bg-ink px-4 text-xs font-medium text-white transition-colors hover:bg-ink/90"
        >
          Apply range
        </button>
      </form>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={Users} label="Visitors" value={overview.visitors.toLocaleString()} />
        <StatTile icon={Activity} label="Sessions" value={overview.sessions.toLocaleString()} />
        <StatTile icon={Target} label="Leads" value={overview.leads.toLocaleString()} />
        <StatTile icon={Percent} label="Conversion" value={`${overview.conversionRate.toFixed(1)}%`} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ExportCard title="Overview" query={query} basePath="/api/reports/overview" formats={["csv", "xlsx", "pdf"]} />
        <ExportCard title="Leads" query={query} basePath="/api/reports/leads" formats={["csv", "xlsx"]} />
        <ExportCard title="Campaigns" query={query} basePath="/api/reports/campaigns" formats={["csv", "xlsx"]} />
      </div>
    </>
  );
}

function ExportCard({
  title,
  query,
  basePath,
  formats,
}: {
  title: string;
  query: string;
  basePath: string;
  formats: ("csv" | "xlsx" | "pdf")[];
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">{title}</h3>
      <div className="flex gap-2">
        {formats.map((format) => (
          <a
            key={format}
            href={`${basePath}?format=${format}&${query}`}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium uppercase text-slate-600 transition-colors hover:bg-slate-50"
          >
            {format}
          </a>
        ))}
      </div>
    </div>
  );
}
