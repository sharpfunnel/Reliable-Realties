"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Check, Copy, Loader2, Send, ShieldAlert, X } from "lucide-react";

import { previewManualCapiEvent, sendManualCapiEvent } from "@/lib/meta/actions";
import { CAPI_EVENT_TYPES, type CapiEventType, type ManualCapiOptions } from "@/lib/meta/capi-constants";
import type { ManualCapiPreview, ManualCapiResult } from "@/lib/meta/capi";
import { cn } from "@/lib/cn";

export type SendCapiLead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  city: string | null;
  country: string | null;
  metaAdId: string | null;
  placement: string | null;
  fbclid: string | null;
};

const INPUT_CLASS =
  "h-9 w-full rounded-lg border border-slate-200 px-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-gold";

function ContextRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] uppercase tracking-wide text-slate-400">{label}</span>
      <span className={cn("truncate text-right text-xs", value ? "text-slate-700" : "text-slate-300")}>
        {value || "—"}
      </span>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
    >
      {copied ? <Check className="size-3" strokeWidth={2} /> : <Copy className="size-3" strokeWidth={2} />}
      {copied ? "Copied" : "Copy JSON"}
    </button>
  );
}

export function SendCapiModal({ lead }: { lead: SendCapiLead }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
        title="Send a Meta Conversions API event for this lead"
      >
        <Send className="size-3" strokeWidth={2} />
        Send
      </button>

      {open ? <SendCapiDialog lead={lead} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function SendCapiDialog({ lead, onClose }: { lead: SendCapiLead; onClose: () => void }) {
  const [eventType, setEventType] = useState<CapiEventType>("Purchase");
  const [customEventName, setCustomEventName] = useState("");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [orderId, setOrderId] = useState("");

  const [preview, setPreview] = useState<ManualCapiPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewPending, startPreview] = useTransition();

  const [result, setResult] = useState<ManualCapiResult | null>(null);
  const [sending, startSending] = useTransition();

  const sent = result?.ok === true;

  const buildOptions = useCallback((): ManualCapiOptions => {
    const parsedValue = value.trim() === "" ? undefined : Number(value);
    return {
      eventType,
      customEventName: customEventName.trim() || undefined,
      value: parsedValue !== undefined && Number.isFinite(parsedValue) ? parsedValue : undefined,
      currency: currency.trim() || undefined,
      orderId: orderId.trim() || undefined,
    };
  }, [eventType, customEventName, value, currency, orderId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Debounced so typing a value doesn't queue a preview per keystroke — Server
  // Actions dispatch one at a time per client, so bursts would serialize.
  useEffect(() => {
    if (sent) return;

    const timer = setTimeout(() => {
      startPreview(async () => {
        const next = await previewManualCapiEvent(lead.id, buildOptions());
        if ("error" in next) {
          setPreview(null);
          setPreviewError(next.error);
        } else {
          setPreview(next);
          setPreviewError(null);
        }
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [lead.id, buildOptions, sent]);

  const json = preview ? JSON.stringify(preview.body, null, 2) : "";
  const errorMessage = result && !result.ok ? result.error : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-[2px] sm:p-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-capi-title"
        className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="send-capi-title" className="text-sm font-semibold text-slate-800">
              Send conversion event
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {lead.name || lead.email || lead.phone || lead.id}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </header>

        {result?.ok ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-emerald-50">
              <Check className="size-5 text-emerald-600" strokeWidth={2.5} />
            </span>
            <div>
              <p className="text-sm font-medium text-slate-800">
                {result.eventName} {result.preview ? "previewed" : "sent to Meta"}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-500">{result.eventId}</p>
              {result.fbtraceId ? (
                <p className="mt-0.5 font-mono text-[11px] text-slate-400">trace {result.fbtraceId}</p>
              ) : null}
            </div>
            {result.preview ? (
              <p className="max-w-sm rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                Dev preview only — no Meta credentials are configured, so nothing was sent and the lead was not
                marked as converted.
              </p>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="mt-1 rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-ink/90"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-5 px-5 py-4 md:grid-cols-2">
              <div className="flex flex-col gap-4">
                <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Lead context
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    <ContextRow label="Email" value={lead.email} />
                    <ContextRow label="Phone" value={lead.phone} />
                    <ContextRow label="Location" value={[lead.city, lead.country].filter(Boolean).join(", ") || null} />
                    <ContextRow label="Source" value={lead.source} />
                    <ContextRow label="Ad ID" value={lead.metaAdId} />
                    <ContextRow label="Placement" value={lead.placement} />
                    <ContextRow label="fbclid" value={lead.fbclid} />
                  </div>
                </section>

                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Event</span>
                  <select
                    value={eventType}
                    onChange={(event) => setEventType(event.target.value as CapiEventType)}
                    className={INPUT_CLASS}
                  >
                    {CAPI_EVENT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-slate-400">
                    {CAPI_EVENT_TYPES.find((type) => type.value === eventType)?.hint}
                  </span>
                </label>

                {eventType === "Custom" ? (
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Custom event name
                    </span>
                    <input
                      value={customEventName}
                      onChange={(event) => setCustomEventName(event.target.value)}
                      placeholder="SiteVisitBooked"
                      autoComplete="off"
                      className={INPUT_CLASS}
                    />
                  </label>
                ) : null}

                <div className="grid grid-cols-[2fr_1fr] gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Value</span>
                    <input
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      inputMode="decimal"
                      placeholder="Optional"
                      autoComplete="off"
                      className={INPUT_CLASS}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Currency</span>
                    <input
                      value={currency}
                      onChange={(event) => setCurrency(event.target.value)}
                      autoComplete="off"
                      className={INPUT_CLASS}
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Order / reference ID
                  </span>
                  <input
                    value={orderId}
                    onChange={(event) => setOrderId(event.target.value)}
                    placeholder="Optional"
                    autoComplete="off"
                    className={INPUT_CLASS}
                  />
                  <span className="text-[11px] text-slate-400">
                    Sent as <code>event_id</code> to dedupe against a Pixel event firing the same conversion. Blank
                    uses the lead id.
                  </span>
                </label>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Payload</h3>
                  {previewPending ? (
                    <Loader2 className="size-3.5 animate-spin text-slate-300" strokeWidth={2} />
                  ) : preview ? (
                    <CopyButton value={json} />
                  ) : null}
                </div>

                {previewError ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    {previewError}
                  </p>
                ) : (
                  <pre
                    className={cn(
                      "max-h-80 overflow-auto rounded-xl bg-slate-900 p-4 text-[11px] leading-relaxed text-slate-100 transition-opacity",
                      previewPending && "opacity-60",
                    )}
                  >
                    {json || "Building…"}
                  </pre>
                )}

                {preview && preview.warnings.length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {preview.warnings.map((warning) => (
                      <li key={warning} className="flex gap-1.5 text-[11px] text-amber-700">
                        <ShieldAlert className="mt-0.5 size-3 shrink-0" strokeWidth={2} />
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            {errorMessage ? (
              <p
                role="alert"
                className="mx-5 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600"
              >
                {errorMessage}
              </p>
            ) : null}

            <footer className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
              <p className="text-[11px] text-slate-400">
                Sends immediately to Meta. Conversions cannot be retracted.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={sending || Boolean(previewError)}
                  onClick={() =>
                    startSending(async () => {
                      setResult(await sendManualCapiEvent(lead.id, buildOptions()));
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-ink/90 disabled:opacity-60"
                >
                  {sending ? (
                    <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                  ) : (
                    <Send className="size-3.5" strokeWidth={2} />
                  )}
                  {sending ? "Sending…" : "Send event"}
                </button>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
