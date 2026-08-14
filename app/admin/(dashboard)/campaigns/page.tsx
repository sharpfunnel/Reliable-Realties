import Link from "next/link";
import { DollarSign, Eye, MousePointerClick, Percent, TrendingUp, Link2, Target, Wallet } from "lucide-react";

import { PageHeader } from "@/components/admin/PageHeader";
import { StatTile } from "@/components/admin/StatTile";
import { Table, Thead, Th, Tr, Td, EmptyState } from "@/components/admin/Table";
import { MetaSyncButton } from "@/components/admin/MetaSyncButton";
import { MetaDisconnectButton } from "@/components/admin/MetaDisconnectButton";
import { DateRangeSelect } from "@/components/admin/DateRangeSelect";
import { SpendChart } from "@/components/admin/SpendChart";
import { formatCurrency as currency } from "@/lib/admin/format";
import {
  getMetaAdAccounts,
  getMetaSummaryStats,
  getCampaignPerformance,
  getDailySpendSeries,
} from "@/lib/meta/queries";

const ALLOWED_RANGES = [7, 14, 30, 90];

export default async function AdminCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ meta_error?: string; days?: string }>;
}) {
  const { meta_error, days: rawDays } = await searchParams;
  const parsedDays = Number(rawDays);
  const days = ALLOWED_RANGES.includes(parsedDays) ? parsedDays : 30;

  const [accounts, stats, campaigns, spendSeries] = await Promise.all([
    getMetaAdAccounts(),
    getMetaSummaryStats(days),
    getCampaignPerformance(days),
    getDailySpendSeries(days),
  ]);

  // Newest first: the question "what did we spend yesterday?" is asked far more
  // often than "what did we spend 89 days ago?".
  const dailyRows = [...spendSeries].reverse();
  const daysWithSpend = spendSeries.filter((d) => d.spend > 0).length;

  const connected = accounts.some((a) => a.accessToken);
  const isConfigured = Boolean(process.env.META_APP_ID);

  return (
    <>
      <PageHeader
        title="Campaigns"
        description={`Meta Ads performance, last ${days} days`}
        actions={
          connected ? (
            <>
              <DateRangeSelect days={days} basePath="/admin/campaigns" />
              <MetaSyncButton />
              {accounts
                .filter((a) => a.accessToken)
                .map((a) => (
                  <MetaDisconnectButton key={a.id} accountId={a.id} />
                ))}
            </>
          ) : (
            <a
              href="/api/meta/oauth/start"
              className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gold/90 aria-disabled:pointer-events-none aria-disabled:opacity-50"
              aria-disabled={!isConfigured}
            >
              Connect Meta Ads
            </a>
          )
        }
      />

      {meta_error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          Meta connection failed: {meta_error}
        </p>
      ) : null}

      {!isConfigured ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          META_APP_ID / META_APP_SECRET aren&apos;t configured yet — set them in your environment to enable connecting
          a Meta Ads account.
        </p>
      ) : null}

      {accounts.some((a) => a.lastSyncError) ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          Last sync failed: {accounts.find((a) => a.lastSyncError)?.lastSyncError}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={DollarSign} label="Spend" value={currency(stats.spend, stats.currency)} />
        <StatTile icon={Eye} label="Impressions" value={stats.impressions.toLocaleString()} />
        <StatTile icon={MousePointerClick} label="Clicks" value={stats.clicks.toLocaleString()} />
        <StatTile icon={Percent} label="CTR" value={`${stats.ctr.toFixed(2)}%`} />
        <StatTile icon={TrendingUp} label="CPC" value={currency(stats.cpc, stats.currency)} />
        <StatTile icon={Link2} label="Landing Page Views" value={stats.landingPageViews.toLocaleString()} />
        <StatTile icon={Target} label="Results" value={stats.results.toLocaleString()} />
        <StatTile icon={Wallet} label="Cost / Result" value={currency(stats.costPerResult, stats.currency)} />
      </div>

      {connected ? (
        <>
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-800">Daily spend &amp; leads</h2>
            <SpendChart key={days} data={spendSeries} currency={stats.currency} />
          </section>

          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="text-sm font-semibold text-slate-800">Spend by day</h2>
              <span className="text-xs text-slate-400">Newest first · {daysWithSpend} days with spend</span>
            </div>
            <div className="max-h-[28rem] overflow-y-auto">
              <Table>
                <Thead>
                  <Tr>
                    <Th>Date</Th>
                    <Th className="text-right">Spend</Th>
                    <Th className="text-right">Impressions</Th>
                    <Th className="text-right">Clicks</Th>
                    <Th className="text-right">Results</Th>
                    <Th className="text-right">Our leads</Th>
                    <Th className="text-right">Cost / lead</Th>
                  </Tr>
                </Thead>
                <tbody>
                  {dailyRows.length === 0 ? (
                    <EmptyState message="No daily spend recorded in this range yet." />
                  ) : (
                    dailyRows.map((d) => (
                      <Tr key={d.date}>
                        <Td>{d.date}</Td>
                        <Td className="text-right font-medium text-slate-800">
                          {currency(d.spend, stats.currency)}
                        </Td>
                        <Td className="text-right">{d.impressions.toLocaleString()}</Td>
                        <Td className="text-right">{d.clicks.toLocaleString()}</Td>
                        <Td className="text-right">{d.results.toLocaleString()}</Td>
                        <Td className="text-right">{d.leads.toLocaleString()}</Td>
                        <Td className="text-right">
                          {d.leads > 0 ? currency(d.spend / d.leads, stats.currency) : "—"}
                        </Td>
                      </Tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          </section>
        </>
      ) : null}

      <div className="mt-6">
        <Table>
          <Thead>
            <Tr>
              <Th>Campaign</Th>
              <Th>Status</Th>
              <Th className="text-right">Spend</Th>
              <Th className="text-right">Impressions</Th>
              <Th className="text-right">Clicks</Th>
              <Th className="text-right">Results</Th>
              <Th className="text-right">Cost/Result</Th>
              <Th className="text-right">On-site sessions</Th>
              <Th className="text-right">On-site leads</Th>
            </Tr>
          </Thead>
          <tbody>
            {campaigns.length === 0 ? (
              <EmptyState message="No campaigns synced yet." />
            ) : (
              campaigns.map((c) => (
                <Tr key={c.id}>
                  <Td>
                    <Link
                      href={days === 30 ? `/admin/campaigns/${c.id}` : `/admin/campaigns/${c.id}?days=${days}`}
                      className="font-medium text-slate-800 hover:text-gold"
                    >
                      {c.name}
                    </Link>
                  </Td>
                  <Td className="capitalize">{c.status?.toLowerCase() ?? "—"}</Td>
                  <Td className="text-right">{currency(c.spend, c.currency ?? "INR")}</Td>
                  <Td className="text-right">{c.impressions.toLocaleString()}</Td>
                  <Td className="text-right">{c.clicks.toLocaleString()}</Td>
                  <Td className="text-right">{c.results.toLocaleString()}</Td>
                  <Td className="text-right">{currency(c.costPerResult, c.currency ?? "INR")}</Td>
                  <Td className="text-right">{c.onSiteSessions.toLocaleString()}</Td>
                  <Td className="text-right">{c.onSiteLeads.toLocaleString()}</Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </div>
    </>
  );
}
