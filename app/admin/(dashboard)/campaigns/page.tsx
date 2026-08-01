import Link from "next/link";
import { DollarSign, Eye, MousePointerClick, Percent, TrendingUp, Link2, Target, Wallet } from "lucide-react";

import { PageHeader } from "@/components/admin/PageHeader";
import { StatTile } from "@/components/admin/StatTile";
import { Table, Thead, Th, Tr, Td, EmptyState } from "@/components/admin/Table";
import { MetaSyncButton } from "@/components/admin/MetaSyncButton";
import { MetaDisconnectButton } from "@/components/admin/MetaDisconnectButton";
import { getMetaAdAccounts, getMetaSummaryStats, getCampaignPerformance } from "@/lib/meta/queries";

function currency(value: number, code = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(
    value,
  );
}

export default async function AdminCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ meta_error?: string }>;
}) {
  const { meta_error } = await searchParams;
  const [accounts, stats, campaigns] = await Promise.all([
    getMetaAdAccounts(),
    getMetaSummaryStats(30),
    getCampaignPerformance(30),
  ]);

  const connected = accounts.some((a) => a.accessToken);
  const isConfigured = Boolean(process.env.META_APP_ID);

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Meta Ads performance, last 30 days"
        actions={
          connected ? (
            <>
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
        <StatTile icon={DollarSign} label="Spend" value={currency(stats.spend)} />
        <StatTile icon={Eye} label="Impressions" value={stats.impressions.toLocaleString()} />
        <StatTile icon={MousePointerClick} label="Clicks" value={stats.clicks.toLocaleString()} />
        <StatTile icon={Percent} label="CTR" value={`${stats.ctr.toFixed(2)}%`} />
        <StatTile icon={TrendingUp} label="CPC" value={currency(stats.cpc)} />
        <StatTile icon={Link2} label="Landing Page Views" value={stats.landingPageViews.toLocaleString()} />
        <StatTile icon={Target} label="Results" value={stats.results.toLocaleString()} />
        <StatTile icon={Wallet} label="Cost / Result" value={currency(stats.costPerResult)} />
      </div>

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
                    <Link href={`/admin/campaigns/${c.id}`} className="font-medium text-slate-800 hover:text-gold">
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
