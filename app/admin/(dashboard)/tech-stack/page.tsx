import { PageHeader } from "@/components/admin/PageHeader";
import { DevicesDonut } from "@/components/admin/DevicesDonut";
import { BarList } from "@/components/admin/BarList";
import { Table, Thead, Th, Tr, Td, EmptyState } from "@/components/admin/Table";
import { getTechStackData } from "@/lib/admin/queries";

function formatDuration(seconds: number) {
  if (!seconds) return "0s";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default async function AdminTechStackPage() {
  const data = await getTechStackData(30);

  const devices = data.devices.map((d) => ({
    type: d.label.charAt(0).toUpperCase() + d.label.slice(1),
    count: d.count,
    pct: d.pct,
  }));

  return (
    <>
      <PageHeader
        title="Tech Stack"
        description="What your visitors browse on, and how each cohort actually performs. Last 30 days."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">Devices</h2>
          <p className="mb-4 mt-0.5 text-xs text-slate-400">Share of sessions.</p>
          <DevicesDonut data={devices} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">Browsers</h2>
          <p className="mb-4 mt-0.5 text-xs text-slate-400">Sessions by browser.</p>
          <BarList items={data.browsers.map((b) => ({ label: b.label, value: b.count }))} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">Operating systems</h2>
          <p className="mb-4 mt-0.5 text-xs text-slate-400">Sessions by OS.</p>
          <BarList items={data.operatingSystems.map((o) => ({ label: o.label, value: o.count }))} />
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">Screen resolutions</h2>
          <p className="mb-4 mt-0.5 text-xs text-slate-400">Physical screen size reported by the device.</p>
          <BarList items={data.screenResolutions.map((r) => ({ label: r.label, value: r.count }))} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">Viewport sizes</h2>
          <p className="mb-4 mt-0.5 text-xs text-slate-400">The space your layout actually gets, bucketed.</p>
          <BarList items={data.viewportSizes.map((v) => ({ label: v.label, value: v.count }))} />
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">Connection quality</h2>
          <p className="mb-4 mt-0.5 text-xs text-slate-400">
            {data.connection.avgDownlink != null
              ? `Average downlink ${data.connection.avgDownlink.toFixed(1)} Mbps`
              : "Downlink data unavailable for this period."}
          </p>
          <BarList items={data.connection.quality.map((c) => ({ label: c.label, value: c.count }))} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">Languages</h2>
          <p className="mb-4 mt-0.5 text-xs text-slate-400">Browser locale.</p>
          <BarList items={data.languages.map((l) => ({ label: l.label, value: l.count }))} />
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-800">Performance by browser</h2>
        <p className="mb-4 mt-0.5 text-xs text-slate-400">
          Bounce rate and conversion for each browser, so you can spot a rendering problem before it costs you leads.
        </p>
        <Table>
          <Thead>
            <Tr>
              <Th>Browser</Th>
              <Th className="text-right">Sessions</Th>
              <Th className="text-right">Share</Th>
              <Th className="text-right">Avg. duration</Th>
              <Th className="text-right">Bounce rate</Th>
              <Th className="text-right">Leads</Th>
              <Th className="text-right">Conversion</Th>
            </Tr>
          </Thead>
          <tbody>
            {data.browserPerformance.length === 0 ? (
              <EmptyState />
            ) : (
              data.browserPerformance.map((row) => (
                <Tr key={row.label}>
                  <Td className="font-medium text-slate-800">{row.label}</Td>
                  <Td className="text-right">{row.sessions}</Td>
                  <Td className="text-right">{row.share.toFixed(1)}%</Td>
                  <Td className="text-right">{formatDuration(row.avgDuration)}</Td>
                  <Td className="text-right">{row.bounceRate.toFixed(0)}%</Td>
                  <Td className="text-right">{row.leads}</Td>
                  <Td className="text-right">{row.conversionRate.toFixed(1)}%</Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-800">Performance by operating system</h2>
        <p className="mb-4 mt-0.5 text-xs text-slate-400">The same breakdown across OS versions.</p>
        <Table>
          <Thead>
            <Tr>
              <Th>Operating system</Th>
              <Th className="text-right">Sessions</Th>
              <Th className="text-right">Share</Th>
              <Th className="text-right">Avg. duration</Th>
              <Th className="text-right">Bounce rate</Th>
              <Th className="text-right">Leads</Th>
              <Th className="text-right">Conversion</Th>
            </Tr>
          </Thead>
          <tbody>
            {data.osPerformance.length === 0 ? (
              <EmptyState />
            ) : (
              data.osPerformance.map((row) => (
                <Tr key={row.label}>
                  <Td className="font-medium text-slate-800">{row.label}</Td>
                  <Td className="text-right">{row.sessions}</Td>
                  <Td className="text-right">{row.share.toFixed(1)}%</Td>
                  <Td className="text-right">{formatDuration(row.avgDuration)}</Td>
                  <Td className="text-right">{row.bounceRate.toFixed(0)}%</Td>
                  <Td className="text-right">{row.leads}</Td>
                  <Td className="text-right">{row.conversionRate.toFixed(1)}%</Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </section>
    </>
  );
}
