import Link from "next/link";
import { CheckCircle2, KeyRound, Send, TestTube2, XCircle } from "lucide-react";

import { PageHeader } from "@/components/admin/PageHeader";
import { StatTile } from "@/components/admin/StatTile";
import { Table, Thead, Th, Tr, Td, EmptyState } from "@/components/admin/Table";
import { CapiComposer, type CapiComposerDefaults } from "@/components/admin/CapiComposer";
import {
  getCapiDeliveryCounts,
  getCapiDeliveryLog,
  getCapiDiagnostics,
  getLeadForCapiPreview,
  getLeadsForCapiPreview,
  type CapiPrefillLead,
} from "@/lib/meta/queries";

const BLANK_DEFAULTS: CapiComposerDefaults = {
  eventName: "Lead",
  actionSource: "website",
  eventId: "",
  eventTime: "",
  eventSourceUrl: "",
  email: "",
  phone: "",
  firstName: "",
  lastName: "",
  city: "",
  state: "",
  zip: "",
  country: "",
  externalId: "",
  clientIpAddress: "",
  clientUserAgent: "",
  fbc: "",
  fbp: "",
  value: "0",
  currency: "INR",
  contentName: "",
  leadSource: "",
};

/** `YYYY-MM-DDTHH:mm`, the format a `datetime-local` input expects. */
function toDatetimeLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

function defaultsFromLead(lead: CapiPrefillLead): CapiComposerDefaults {
  const [firstName, ...rest] = (lead.name ?? "").trim().split(/\s+/).filter(Boolean);

  return {
    ...BLANK_DEFAULTS,
    eventId: lead.id,
    eventTime: toDatetimeLocal(lead.createdAt),
    eventSourceUrl: lead.session?.entryPath ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    firstName: firstName ?? "",
    lastName: rest.join(" "),
    clientIpAddress: lead.session?.ipAddress ?? "",
    // Matches how lib/meta/capi.ts synthesizes fbc from a stored fbclid.
    fbc: lead.session?.fbclid ? `fb.1.${lead.createdAt.getTime()}.${lead.session.fbclid}` : "",
    leadSource: lead.source ?? "",
  };
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

const STATUS_STYLES: Record<string, string> = {
  sent: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-600",
  pending: "bg-slate-100 text-slate-500",
};

const STATUS_LABELS: Record<string, string> = {
  sent: "Sent",
  failed: "Failed",
  pending: "Not sent",
};

export default async function AdminMetaCapiPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string }>;
}) {
  const { leadId } = await searchParams;

  const [diagnostics, counts, leads, log, prefillLead] = await Promise.all([
    getCapiDiagnostics(),
    getCapiDeliveryCounts(),
    getLeadsForCapiPreview(25),
    getCapiDeliveryLog(50),
    leadId ? getLeadForCapiPreview(leadId) : Promise.resolve(null),
  ]);

  const defaults = prefillLead ? defaultsFromLead(prefillLead) : BLANK_DEFAULTS;

  const tokenLabel =
    diagnostics.tokenSource === "env"
      ? "Env variable"
      : diagnostics.tokenSource === "adAccount"
        ? "Connected ad account"
        : "Not configured";

  return (
    <>
      <PageHeader
        title="Meta CAPI"
        description="Compose and inspect Conversions API payloads. Dry run — nothing is sent to Meta."
      />

      <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        This page never contacts Meta. It builds and displays the payload only, so you can check the shape, the
        hashing and the config without touching ad delivery or attribution. Real events are still sent automatically
        by the live sender whenever a lead is submitted through the public contact form.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          icon={diagnostics.pixelIdSet ? CheckCircle2 : XCircle}
          label="Pixel ID"
          value={diagnostics.pixelIdSet ? "Configured" : "Not configured"}
          subLabel="META_PIXEL_ID"
        />
        <StatTile
          icon={KeyRound}
          label="Access token"
          value={tokenLabel}
          subLabel={diagnostics.tokenSource === "env" ? "META_CAPI_ACCESS_TOKEN" : "resolved at send time"}
        />
        <StatTile
          icon={TestTube2}
          label="Test event code"
          value={diagnostics.testEventCodeSet ? "Configured" : "Not configured"}
          subLabel="META_CAPI_TEST_EVENT_CODE"
        />
        <StatTile icon={Send} label="Graph API" value={diagnostics.graphVersion} subLabel="version in use" />
      </div>

      <div className="mt-6">
        <CapiComposer
          key={leadId ?? "blank"}
          defaults={defaults}
          selectedLeadId={prefillLead?.id}
          leads={leads.map((lead) => ({
            id: lead.id,
            label: `${lead.name ?? "Unnamed"} — ${lead.email ?? lead.phone ?? "no contact"} · ${formatDate(
              lead.createdAt,
            )}`,
          }))}
        />
      </div>

      <div className="mt-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Delivery log</h2>
          <p className="text-xs text-slate-500">
            {counts.sent} sent · {counts.failed} failed · {counts.pending} not sent, of {counts.total} leads
          </p>
        </div>

        <Table>
          <Thead>
            <Tr>
              <Th>Lead</Th>
              <Th>Created</Th>
              <Th>CAPI status</Th>
              <Th>Sent at</Th>
              <Th>Error</Th>
              <Th className="text-right">Prefill</Th>
            </Tr>
          </Thead>
          <tbody>
            {log.length === 0 ? (
              <EmptyState message="No leads yet." />
            ) : (
              log.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    <span className="font-medium text-slate-800">{row.name ?? "—"}</span>
                    {row.email ? <span className="block text-xs text-slate-400">{row.email}</span> : null}
                  </Td>
                  <Td className="whitespace-nowrap">{formatDate(row.createdAt)}</Td>
                  <Td>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[row.status]}`}
                    >
                      {STATUS_LABELS[row.status]}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {row.metaCapiSentAt ? formatDate(row.metaCapiSentAt) : "—"}
                  </Td>
                  <Td className="max-w-xs truncate text-xs text-red-600" title={row.metaCapiError ?? undefined}>
                    {row.metaCapiError ?? "—"}
                  </Td>
                  <Td className="text-right">
                    <Link
                      href={`/admin/meta-capi?leadId=${row.id}`}
                      className="inline-flex items-center rounded-full border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      Prefill
                    </Link>
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </div>
    </>
  );
}
