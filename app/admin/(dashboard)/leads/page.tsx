import Link from "next/link";

import { PageHeader } from "@/components/admin/PageHeader";
import { Table, Thead, Th, Tr, Td, EmptyState } from "@/components/admin/Table";
import { LeadStatusSelect } from "@/components/admin/LeadStatusSelect";
import { SendCapiModal } from "@/components/admin/SendCapiModal";
import { cn } from "@/lib/cn";
import { formatRawParams } from "@/lib/admin/attribution";
import { getLeads } from "@/lib/admin/queries";

const FILTERS = ["all", "new", "contacted", "qualified", "won", "lost"];

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "all" } = await searchParams;
  const leads = await getLeads(status);

  return (
    <>
      <PageHeader title="Leads" description={`${leads.length} lead${leads.length === 1 ? "" : "s"}`} />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((filter) => (
          <Link
            key={filter}
            href={filter === "all" ? "/admin/leads" : `/admin/leads?status=${filter}`}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
              status === filter ? "bg-ink text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            )}
          >
            {filter}
          </Link>
        ))}
      </div>

      <Table>
        <Thead>
          <Tr>
            <Th>Name</Th>
            <Th>Phone</Th>
            <Th>Email</Th>
            <Th>Budget</Th>
            <Th>Source</Th>
            <Th>Status</Th>
            <Th>Meta CAPI</Th>
            <Th>Received</Th>
          </Tr>
        </Thead>
        <tbody>
          {leads.length === 0 ? (
            <EmptyState />
          ) : (
            leads.map((lead) => (
              <Tr key={lead.id}>
                <Td className="font-medium text-slate-800">{lead.name ?? "—"}</Td>
                <Td>{lead.phone ?? "—"}</Td>
                <Td>{lead.email ?? "—"}</Td>
                <Td>{lead.budget ?? "—"}</Td>
                <Td>
                  <div>{lead.source ?? "—"}</div>
                  {lead.session?.utmSource && (
                    <div
                      className="mt-0.5 text-xs text-slate-400"
                      title={formatRawParams(lead.session.rawParams)?.full}
                    >
                      <div>
                        {lead.session.utmSource}/{lead.session.utmMedium ?? "—"}
                        {lead.session.utmCampaign && ` · ${lead.session.utmCampaign}`}
                      </div>
                      {(lead.session.utmContent || lead.session.utmTerm) && (
                        <div>
                          {lead.session.utmContent && `ad: ${lead.session.utmContent}`}
                          {lead.session.utmContent && lead.session.utmTerm && " · "}
                          {lead.session.utmTerm && `adset: ${lead.session.utmTerm}`}
                        </div>
                      )}
                      {lead.session.placement && <div>{lead.session.placement}</div>}
                    </div>
                  )}
                </Td>
                <Td>
                  <LeadStatusSelect leadId={lead.id} status={lead.status} />
                </Td>
                <Td>
                  <div className="flex items-center gap-1.5">
                    {lead.metaCapiSentAt ? (
                      <span className="text-[11px] font-medium text-emerald-600">Sent</span>
                    ) : lead.metaCapiError ? (
                      <span className="text-[11px] font-medium text-red-500" title={lead.metaCapiError}>
                        Failed
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">—</span>
                    )}
                    <SendCapiModal
                      lead={{
                        id: lead.id,
                        name: lead.name,
                        email: lead.email,
                        phone: lead.phone,
                        source: lead.source,
                        city: lead.visitor?.city ?? null,
                        country: lead.visitor?.country ?? null,
                        metaAdId: lead.session?.metaAdId ?? null,
                        placement: lead.session?.placement ?? null,
                        fbclid: lead.session?.fbclid ?? null,
                      }}
                    />
                  </div>
                </Td>
                <Td className="whitespace-nowrap">{lead.createdAt.toLocaleString()}</Td>
              </Tr>
            ))
          )}
        </tbody>
      </Table>
    </>
  );
}
