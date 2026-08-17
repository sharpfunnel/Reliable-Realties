"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Check, Copy, Loader2, Send, ShieldAlert, X } from "lucide-react";

import {
  previewSessionCapiEvent,
  sendSessionCapiEvent,
  sendSessionCapiEventsBulk,
} from "@/lib/meta/actions";
import {
  CAPI_EVENT_TYPES,
  DEFAULT_SESSION_EVENT_NAME,
  SESSION_QUALITY_GRADES,
  qualityGrade,
  type CapiEventType,
  type ManualSessionCapiOptions,
  type SessionQualityGrade,
} from "@/lib/meta/capi-constants";
import type { BulkSessionCapiResult, ManualCapiPreview, ManualCapiResult } from "@/lib/meta/capi";
import { cn } from "@/lib/cn";

/**
 * What a row hands the modal. Display only — the id is the only field that
 * reaches the server, and every identifier is re-read there, so the browser can
 * never dictate whose data goes to Meta.
 */
export type SendSessionCapiSession = {
  id: string;
  city: string | null;
  country: string | null;
  trafficSource: string;
  totalDuration: number | null;
  pagesViewed: number;
  maxScrollPct: number;
  ctaClicked: boolean;
  formStarted: boolean;
  formSubmitted: boolean;
  capiIdentifiers: string[];
  capiSendable: boolean;
  metaCapiQuality: string | null;
};

const INPUT_CLASS =
  "h-9 w-full rounded-lg border border-slate-200 px-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-gold";

function formatDuration(seconds: number | null) {
  if (seconds === null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

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

const GRADE_STYLES: Record<string, string> = {
  hot: "border-red-300 bg-red-50 text-red-700",
  warm: "border-amber-300 bg-amber-50 text-amber-700",
  cold: "border-sky-300 bg-sky-50 text-sky-700",
};

function QualityPicker({
  quality,
  onChange,
}: {
  quality: SessionQualityGrade;
  onChange: (next: SessionQualityGrade) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        Client quality
      </legend>
      <div className="grid grid-cols-3 gap-2">
        {SESSION_QUALITY_GRADES.map((grade) => (
          <button
            key={grade.value}
            type="button"
            aria-pressed={quality === grade.value}
            onClick={() => onChange(grade.value)}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
              quality === grade.value
                ? GRADE_STYLES[grade.value]
                : "border-slate-200 text-slate-500 hover:bg-slate-50",
            )}
          >
            {grade.label}
            <span className="text-[10px] font-normal opacity-70">₹{grade.conversionValue.toLocaleString("en-IN")}</span>
          </button>
        ))}
      </div>
      <span className="text-[11px] text-slate-400">{qualityGrade(quality)?.hint}</span>
    </fieldset>
  );
}

/** The grade/event/value controls, shared by the single and bulk dialogs. */
function GradeControls({
  quality,
  setQuality,
  eventType,
  setEventType,
  customEventName,
  setCustomEventName,
  value,
  setValue,
  currency,
  setCurrency,
}: {
  quality: SessionQualityGrade;
  setQuality: (next: SessionQualityGrade) => void;
  eventType: CapiEventType;
  setEventType: (next: CapiEventType) => void;
  customEventName: string;
  setCustomEventName: (next: string) => void;
  value: string;
  setValue: (next: string) => void;
  currency: string;
  setCurrency: (next: string) => void;
}) {
  return (
    <>
      <QualityPicker quality={quality} onChange={setQuality} />

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
            placeholder={DEFAULT_SESSION_EVENT_NAME}
            autoComplete="off"
            className={INPUT_CLASS}
          />
          <span className="text-[11px] text-slate-400">
            Keep this separate from <code>Lead</code> so graded visits never mix with real form submissions.
          </span>
        </label>
      ) : null}

      <div className="grid grid-cols-[2fr_1fr] gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Value override</span>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            inputMode="decimal"
            placeholder={String(qualityGrade(quality)?.conversionValue ?? "")}
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
    </>
  );
}

function PayloadPane({
  preview,
  previewError,
  previewPending,
}: {
  preview: ManualCapiPreview | null;
  previewError: string | null;
  previewPending: boolean;
}) {
  const json = preview ? JSON.stringify(preview.body, null, 2) : "";

  return (
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
  );
}

function DialogShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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
        aria-labelledby="send-session-capi-title"
        className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="send-session-capi-title" className="text-sm font-semibold text-slate-800">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
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
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single session
// ---------------------------------------------------------------------------

export function SendSessionCapiModal({ session }: { session: SendSessionCapiSession }) {
  const [open, setOpen] = useState(false);

  if (!session.capiSendable) {
    return (
      <span
        className="text-[11px] text-slate-300"
        title="No email, phone, fbp or fbc — Meta has no way to identify this visitor, so an event would be discarded."
      >
        no match
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
        title="Grade this visitor and report them to Meta"
      >
        <Send className="size-3" strokeWidth={2} />
        Grade
      </button>

      {open ? <SendSessionCapiDialog session={session} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function SendSessionCapiDialog({
  session,
  onClose,
}: {
  session: SendSessionCapiSession;
  onClose: () => void;
}) {
  const [quality, setQuality] = useState<SessionQualityGrade>(
    (session.metaCapiQuality as SessionQualityGrade | null) ?? "warm",
  );
  const [eventType, setEventType] = useState<CapiEventType>("Custom");
  const [customEventName, setCustomEventName] = useState(DEFAULT_SESSION_EVENT_NAME);
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("INR");

  const [preview, setPreview] = useState<ManualCapiPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewPending, startPreview] = useTransition();

  const [result, setResult] = useState<ManualCapiResult | null>(null);
  const [sending, startSending] = useTransition();

  const sent = result?.ok === true;

  const buildOptions = useCallback((): ManualSessionCapiOptions => {
    const parsedValue = value.trim() === "" ? undefined : Number(value);
    return {
      quality,
      eventType,
      customEventName: customEventName.trim() || undefined,
      value: parsedValue !== undefined && Number.isFinite(parsedValue) ? parsedValue : undefined,
      currency: currency.trim() || undefined,
    };
  }, [quality, eventType, customEventName, value, currency]);

  // Debounced for the same reason as the lead modal: Server Actions dispatch
  // one at a time per client, so a burst of keystrokes would serialize.
  useEffect(() => {
    if (sent) return;

    const timer = setTimeout(() => {
      startPreview(async () => {
        const next = await previewSessionCapiEvent(session.id, buildOptions());
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
  }, [session.id, buildOptions, sent]);

  const errorMessage = result && !result.ok ? result.error : null;
  const location = [session.city, session.country].filter(Boolean).join(", ") || null;

  return (
    <DialogShell
      title="Grade visitor and send to Meta"
      subtitle={location ? `${location} · ${session.trafficSource}` : session.id}
      onClose={onClose}
    >
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
              Dev preview only — no Meta credentials are configured, so nothing was sent and the grade was not
              saved.
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
                  What this visitor did
                </h3>
                <div className="flex flex-col gap-1.5">
                  <ContextRow label="Time on site" value={formatDuration(session.totalDuration)} />
                  <ContextRow label="Pages" value={String(session.pagesViewed)} />
                  <ContextRow label="Max scroll" value={`${session.maxScrollPct}%`} />
                  <ContextRow
                    label="Engaged"
                    value={
                      [
                        session.ctaClicked ? "CTA" : null,
                        session.formStarted ? "form started" : null,
                        session.formSubmitted ? "form submitted" : null,
                      ]
                        .filter(Boolean)
                        .join(", ") || null
                    }
                  />
                  <ContextRow label="Location" value={location} />
                  <ContextRow label="Source" value={session.trafficSource} />
                  <ContextRow label="Matches on" value={session.capiIdentifiers.join(", ") || null} />
                </div>
              </section>

              <GradeControls
                quality={quality}
                setQuality={setQuality}
                eventType={eventType}
                setEventType={setEventType}
                customEventName={customEventName}
                setCustomEventName={setCustomEventName}
                value={value}
                setValue={setValue}
                currency={currency}
                setCurrency={setCurrency}
              />
            </div>

            <PayloadPane preview={preview} previewError={previewError} previewPending={previewPending} />
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
                    setResult(await sendSessionCapiEvent(session.id, buildOptions()));
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
    </DialogShell>
  );
}

// ---------------------------------------------------------------------------
// Bulk
// ---------------------------------------------------------------------------

export function SendSessionCapiBulkDialog({
  sessions,
  onClose,
}: {
  sessions: SendSessionCapiSession[];
  onClose: () => void;
}) {
  const sendable = sessions.filter((session) => session.capiSendable);
  const unmatchable = sessions.length - sendable.length;

  const [quality, setQuality] = useState<SessionQualityGrade>("warm");
  const [eventType, setEventType] = useState<CapiEventType>("Custom");
  const [customEventName, setCustomEventName] = useState(DEFAULT_SESSION_EVENT_NAME);
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("INR");

  const [preview, setPreview] = useState<ManualCapiPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewPending, startPreview] = useTransition();

  const [result, setResult] = useState<BulkSessionCapiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, startSending] = useTransition();

  const buildOptions = useCallback((): ManualSessionCapiOptions => {
    const parsedValue = value.trim() === "" ? undefined : Number(value);
    return {
      quality,
      eventType,
      customEventName: customEventName.trim() || undefined,
      value: parsedValue !== undefined && Number.isFinite(parsedValue) ? parsedValue : undefined,
      currency: currency.trim() || undefined,
    };
  }, [quality, eventType, customEventName, value, currency]);

  // The batch is homogeneous apart from identity, so previewing the first
  // sendable session shows the shape every event in it will take.
  const sampleId = sendable[0]?.id;

  useEffect(() => {
    if (!sampleId || result) return;

    const timer = setTimeout(() => {
      startPreview(async () => {
        const next = await previewSessionCapiEvent(sampleId, buildOptions());
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
  }, [sampleId, buildOptions, result]);

  return (
    <DialogShell
      title={`Grade ${sendable.length} visitor${sendable.length === 1 ? "" : "s"}`}
      subtitle={
        unmatchable > 0
          ? `${unmatchable} of ${sessions.length} selected cannot be matched by Meta and will be skipped`
          : "All selected sessions carry an identifier Meta can match"
      }
      onClose={onClose}
    >
      {result ? (
        <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-emerald-50">
            <Check className="size-5 text-emerald-600" strokeWidth={2.5} />
          </span>
          <div>
            <p className="text-sm font-medium text-slate-800">
              {result.sent} {result.preview ? "previewed" : "sent to Meta"}
              {result.failed > 0 ? `, ${result.failed} failed` : ""}
              {result.skipped.length > 0 ? `, ${result.skipped.length} skipped` : ""}
            </p>
            {result.skipped.length > 0 ? (
              <p className="mt-1 text-[11px] text-slate-500">
                Skipped sessions had no identifier Meta could match. They were left untouched.
              </p>
            ) : null}
          </div>
          {result.errors.length > 0 ? (
            <ul className="max-w-sm rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left text-[11px] text-red-600">
              {result.errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
          {result.preview ? (
            <p className="max-w-sm rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
              Dev preview only — no Meta credentials are configured, so nothing was sent and no grades were saved.
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
              <p className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-[11px] text-slate-500">
                One grade is applied to every selected session. Sessions Meta cannot match are skipped
                automatically — grading them would report a conversion nobody can attribute.
              </p>

              <GradeControls
                quality={quality}
                setQuality={setQuality}
                eventType={eventType}
                setEventType={setEventType}
                customEventName={customEventName}
                setCustomEventName={setCustomEventName}
                value={value}
                setValue={setValue}
                currency={currency}
                setCurrency={setCurrency}
              />
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[11px] text-slate-400">
                Sample payload — the first sendable session. Every event in the batch has this shape with its own
                identifiers.
              </p>
              <PayloadPane preview={preview} previewError={previewError} previewPending={previewPending} />
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="mx-5 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600"
            >
              {error}
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
                disabled={sending || sendable.length === 0}
                onClick={() =>
                  startSending(async () => {
                    const next = await sendSessionCapiEventsBulk(
                      sendable.map((session) => session.id),
                      buildOptions(),
                    );
                    if ("error" in next) setError(next.error);
                    else setResult(next);
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-ink/90 disabled:opacity-60"
              >
                {sending ? (
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <Send className="size-3.5" strokeWidth={2} />
                )}
                {sending ? "Sending…" : `Send ${sendable.length} event${sendable.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </footer>
        </>
      )}
    </DialogShell>
  );
}
