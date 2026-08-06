"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  X,
  Phone,
  MessageCircle,
  Mail,
  PlayCircle,
  Clock,
  FileText,
  MousePointerClick,
  ArrowDownWideNarrow,
} from "lucide-react";

import { LeadStatusSelect } from "@/components/admin/LeadStatusSelect";
import { SendCapiModal } from "@/components/admin/SendCapiModal";
import { referrerHost } from "@/lib/admin/attribution";
import { fetchLeadDetail } from "@/lib/admin/actions";
import type { LeadRow, LeadDetail } from "@/lib/admin/queries";

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "0s";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function waHref(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountryCode}`;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={value ? "mt-0.5 text-sm text-slate-800" : "mt-0.5 text-sm text-slate-300"}>{value || "—"}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-100 px-5 py-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      {children}
    </section>
  );
}

export function LeadDetailPanel({ lead, onClose }: { lead: LeadRow; onClose: () => void }) {
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [loading, startLoading] = useTransition();

  useEffect(() => {
    startLoading(async () => {
      const result = await fetchLeadDetail(lead.id);
      setDetail(result);
    });
  }, [lead.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const wa = waHref(lead.phone);
  const location = [lead.city, lead.country].filter(Boolean).join(", ");

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-detail-title"
        className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4">
          <div className="min-w-0">
            <h2 id="lead-detail-title" className="truncate text-base font-semibold text-slate-900">
              {lead.name || "Unnamed lead"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {lead.displayId} · {formatRelative(lead.createdAt)}
              {location ? ` · ${location}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LeadStatusSelect leadId={lead.id} status={lead.status} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          </div>
        </header>

        <div className="flex flex-wrap gap-2 px-5 py-3">
          {lead.phone ? (
            <a
              href={`tel:${lead.phone}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Phone className="size-3.5" strokeWidth={2} />
              Call
            </a>
          ) : null}
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <MessageCircle className="size-3.5" strokeWidth={2} />
              WhatsApp
            </a>
          ) : null}
          {lead.email ? (
            <a
              href={`mailto:${lead.email}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Mail className="size-3.5" strokeWidth={2} />
              Email
            </a>
          ) : null}
          {lead.sessionId && detail?.hasReplay ? (
            <Link
              href={`/admin/sessions/${lead.sessionId}/replay`}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-ink/90"
            >
              <PlayCircle className="size-3.5" strokeWidth={2} />
              Watch session
            </Link>
          ) : null}
        </div>

        <Section title="Submitted information">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Phone" value={lead.phone} />
            <Field label="Email" value={lead.email} />
            <Field label="Budget" value={lead.budget} />
            <Field label="City" value={lead.city} />
            <Field label="Country" value={lead.country} />
          </div>
          {lead.message ? (
            <div className="mt-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Message</div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{lead.message}</p>
            </div>
          ) : null}
        </Section>

        <Section title="Attribution">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Source" value={lead.source} />
            <Field label="Campaign" value={lead.campaign} />
            <Field label="UTM Source" value={lead.utmSource} />
            <Field label="UTM Medium" value={lead.utmMedium} />
            <Field label="UTM Campaign" value={lead.utmCampaign} />
            <Field label="Landing Page" value={detail?.landingPage} />
            <Field label="Referrer" value={detail ? referrerHost(detail.referrer) : undefined} />
          </div>
        </Section>

        <Section title="Device & network">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Device" value={lead.device} />
            <Field label="Browser" value={lead.browser} />
            <Field label="Operating system" value={lead.os} />
            <Field label="IP address" value={lead.ipAddress} />
            <Field label="Visitor ID" value={lead.visitorId} />
            <Field label="Total visits" value={detail ? String(detail.totalVisits) : undefined} />
          </div>
        </Section>

        <Section title="Meta Conversions API">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">
              {lead.metaCapiSentAt ? (
                <span className="font-medium text-emerald-600">Sent to Meta</span>
              ) : lead.metaCapiError ? (
                <span className="font-medium text-red-500" title={lead.metaCapiError}>
                  Failed to send
                </span>
              ) : (
                <span className="text-slate-400">Not sent yet</span>
              )}
            </div>
            <SendCapiModal
              lead={{
                id: lead.id,
                name: lead.name,
                email: lead.email,
                phone: lead.phone,
                source: lead.source,
                city: lead.city,
                country: lead.country,
                metaAdId: lead.metaAdId,
                placement: lead.placement,
                fbclid: lead.fbclid,
              }}
            />
          </div>
        </Section>

        {!lead.sessionId ? (
          <Section title="Visitor journey">
            <p className="text-sm text-slate-400">No tracked session is linked to this lead.</p>
          </Section>
        ) : (
          <>
            <Section title="Visitor journey">
              {loading && !detail ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : detail?.journey ? (
                <div className="grid grid-cols-4 gap-2">
                  <JourneyStat icon={Clock} label="Duration" value={formatDuration(detail.journey.durationSeconds)} />
                  <JourneyStat icon={FileText} label="Pages" value={String(detail.journey.pagesViewed)} />
                  <JourneyStat
                    icon={ArrowDownWideNarrow}
                    label="Max scroll"
                    value={`${detail.journey.maxScrollPct}%`}
                  />
                  <JourneyStat icon={MousePointerClick} label="Clicks" value={String(detail.journey.clicks)} />
                </div>
              ) : (
                <p className="text-sm text-slate-400">No journey data.</p>
              )}
            </Section>

            {detail && detail.pageViews.length > 0 ? (
              <Section title="Pages visited">
                <div className="flex flex-col gap-1.5">
                  {detail.pageViews.map((pv, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
                    >
                      <span className="truncate text-slate-700">{pv.path}</span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {pv.timeOnPageSeconds ? formatDuration(pv.timeOnPageSeconds) : "—"}
                        {pv.pctOfDuration > 0 ? ` · ${Math.round(pv.pctOfDuration)}%` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}

            {detail && detail.timeline.length > 0 ? (
              <Section title="Activity timeline">
                <ol className="flex flex-col gap-3">
                  {detail.timeline.map((entry, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold" />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-700">{entry.label}</p>
                        <p className="text-[11px] text-slate-400">{formatRelative(entry.at)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function JourneyStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-slate-100 bg-slate-50/60 py-3 text-center">
      <Icon className="size-3.5 text-gold" strokeWidth={2} />
      <span className="text-sm font-semibold text-slate-800">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
    </div>
  );
}
