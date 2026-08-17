import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/PageHeader";
import { Table, Thead, Th, Tr, Td, EmptyState } from "@/components/admin/Table";
import { getCampaignDetail } from "@/lib/meta/queries";
import { formatCurrency } from "@/lib/admin/format";

// Per-ad CPC/CPM are small numbers — rounding them to whole rupees would erase
// the differences the page exists to show.
const currency = (value: number, code = "INR") => formatCurrency(value, code, 2);

const ALLOWED_RANGES = [7, 14, 30, 90];

export default async function AdminCampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const { id } = await params;
  const { days: rawDays } = await searchParams;
  const parsedDays = Number(rawDays);
  const days = ALLOWED_RANGES.includes(parsedDays) ? parsedDays : 30;

  const campaign = await getCampaignDetail(id, days);
  if (!campaign) notFound();

  const currencyCode = campaign.adAccount.currency ?? "INR";

  return (
    <>
      <PageHeader
        title={campaign.name}
        description={`${campaign.adAccount.name ?? campaign.adAccount.accountId} · ${campaign.objective ?? "—"} · ${campaign.status ?? "—"} · last ${days} days`}
      />

      {campaign.adSets.length === 0 ? (
        <p className="text-sm text-slate-400">No ad sets synced for this campaign yet.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {campaign.adSets.map((adSet) => (
            <section key={adSet.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-800">{adSet.name}</h2>
                <span className="text-xs text-slate-500">
                  Spend {currency(adSet.spend, currencyCode)} · CPC {currency(adSet.cpc, currencyCode)} · CPM{" "}
                  {currency(adSet.cpm, currencyCode)}
                </span>
              </div>

              <Table>
                <Thead>
                  <Tr>
                    <Th>Ad</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Spend</Th>
                    <Th className="text-right">CTR</Th>
                    <Th className="text-right">CPC</Th>
                    <Th className="text-right">CPM</Th>
                    <Th className="text-right">Results</Th>
                  </Tr>
                </Thead>
                <tbody>
                  {adSet.ads.length === 0 ? (
                    <EmptyState message="No ads in this ad set yet." />
                  ) : (
                    adSet.ads.map((ad) => (
                      <Tr key={ad.id}>
                        <Td className="font-medium text-slate-800">{ad.name}</Td>
                        <Td className="capitalize">{ad.status?.toLowerCase() ?? "—"}</Td>
                        <Td className="text-right">{currency(ad.spend, currencyCode)}</Td>
                        <Td className="text-right">{ad.ctr.toFixed(2)}%</Td>
                        <Td className="text-right">{currency(ad.cpc, currencyCode)}</Td>
                        <Td className="text-right">{currency(ad.cpm, currencyCode)}</Td>
                        <Td className="text-right">{ad.results.toLocaleString()}</Td>
                      </Tr>
                    ))
                  )}
                </tbody>
              </Table>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
