"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, FileJson, ShieldAlert } from "lucide-react";

import { previewCapiEvent, type CapiPreviewState } from "@/lib/meta/actions";
import { ACTION_SOURCES, EVENT_NAMES } from "@/lib/meta/capi-constants";
import { cn } from "@/lib/cn";

export type CapiComposerDefaults = {
  eventName: string;
  actionSource: string;
  eventId: string;
  eventTime: string;
  eventSourceUrl: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  externalId: string;
  clientIpAddress: string;
  clientUserAgent: string;
  fbc: string;
  fbp: string;
  value: string;
  currency: string;
  contentName: string;
  leadSource: string;
};

const initialState: CapiPreviewState = {};

const INPUT_CLASS =
  "h-9 w-full rounded-lg border border-slate-200 px-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-gold";

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={INPUT_CLASS}
        autoComplete="off"
      />
      {hint ? <span className="text-[11px] text-slate-400">{hint}</span> : null}
    </label>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </div>
  );
}

function CopyButton({ label, value }: { label: string; value: string }) {
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
      {copied ? "Copied" : label}
    </button>
  );
}

export function CapiComposer({
  defaults,
  leads,
  selectedLeadId,
}: {
  defaults: CapiComposerDefaults;
  leads: { id: string; label: string }[];
  selectedLeadId?: string;
}) {
  const [state, formAction, pending] = useActionState(previewCapiEvent, initialState);
  const router = useRouter();

  const preview = state.preview;
  const json = preview ? JSON.stringify(preview.body, null, 2) : "";
  const curl = preview
    ? `curl -X POST '${preview.endpoint}' \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify(preview.body)}'`
    : "";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <Card title="Prefill from an existing lead">
          <select
            value={selectedLeadId ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              router.push(id ? `/admin/meta-capi?leadId=${encodeURIComponent(id)}` : "/admin/meta-capi");
            }}
            className={INPUT_CLASS}
          >
            <option value="">— Blank form —</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[11px] text-slate-400">
            Loads real data from the database into the form below. Still a dry run — nothing is sent.
          </p>
        </Card>

        <form action={formAction} className="flex flex-col gap-4">
          <Card title="Event">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">event_name</span>
                <select name="eventName" defaultValue={defaults.eventName} className={INPUT_CLASS}>
                  {EVENT_NAMES.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">action_source</span>
                <select name="actionSource" defaultValue={defaults.actionSource} className={INPUT_CLASS}>
                  {ACTION_SOURCES.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="event_id"
                name="eventId"
                defaultValue={defaults.eventId}
                hint="Used to dedupe against a browser pixel event."
              />
              <Field
                label="event_time"
                name="eventTime"
                type="datetime-local"
                defaultValue={defaults.eventTime}
                hint="Blank = now. Meta rejects events older than 7 days."
              />
              <div className="sm:col-span-2">
                <Field
                  label="event_source_url"
                  name="eventSourceUrl"
                  defaultValue={defaults.eventSourceUrl}
                  placeholder="https://reliablerealties.com/"
                />
              </div>
            </div>
          </Card>

          <Card title="user_data">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email (em)" name="email" defaultValue={defaults.email} placeholder="jane@example.com" />
              <Field
                label="Phone (ph)"
                name="phone"
                defaultValue={defaults.phone}
                placeholder="919876543210"
                hint="Include the country code."
              />
              <Field label="First name (fn)" name="firstName" defaultValue={defaults.firstName} />
              <Field label="Last name (ln)" name="lastName" defaultValue={defaults.lastName} />
              <Field label="City (ct)" name="city" defaultValue={defaults.city} />
              <Field label="State (st)" name="state" defaultValue={defaults.state} />
              <Field label="Zip (zp)" name="zip" defaultValue={defaults.zip} />
              <Field label="Country" name="country" defaultValue={defaults.country} placeholder="in" />
              <Field label="external_id" name="externalId" defaultValue={defaults.externalId} />
              <Field label="client_ip_address" name="clientIpAddress" defaultValue={defaults.clientIpAddress} />
              <div className="sm:col-span-2">
                <Field label="client_user_agent" name="clientUserAgent" defaultValue={defaults.clientUserAgent} />
              </div>
              <div className="sm:col-span-2">
                <Field label="fbc" name="fbc" defaultValue={defaults.fbc} placeholder="fb.1.1700000000.AbCdEf" />
              </div>
              <div className="sm:col-span-2">
                <Field label="fbp" name="fbp" defaultValue={defaults.fbp} placeholder="fb.1.1700000000.1234567890" />
              </div>
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              Everything above except client_ip_address, client_user_agent, fbc and fbp is SHA-256 hashed before it
              leaves the server.
            </p>
          </Card>

          <Card title="custom_data">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="value" name="value" defaultValue={defaults.value} placeholder="0" />
              <Field label="currency" name="currency" defaultValue={defaults.currency} placeholder="INR" />
              <Field label="content_name" name="contentName" defaultValue={defaults.contentName} />
              <Field label="lead_source" name="leadSource" defaultValue={defaults.leadSource} />
            </div>
          </Card>

          <Card title="Options">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="includeTestEventCode"
                defaultChecked
                className="size-4 rounded border-slate-300 accent-gold"
              />
              Include test_event_code
            </label>
          </Card>

          {state.error ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {state.error}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-ink/90 disabled:opacity-60"
            >
              <FileJson className={cn("size-3.5", pending && "animate-pulse")} strokeWidth={2} />
              {pending ? "Building…" : "Build payload"}
            </button>
            <span className="text-[11px] text-slate-400">Builds the JSON only. Nothing is sent to Meta.</span>
          </div>
        </form>
      </div>

      <div className="flex flex-col gap-4">
        {preview ? (
          <>
            <Card title="Request">
              <p className="break-all font-mono text-xs text-slate-600">
                <span className="font-semibold text-slate-800">POST</span> {preview.endpoint}
              </p>
              <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
                {json}
              </pre>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <CopyButton label="Copy JSON" value={json} />
                <CopyButton label="Copy curl" value={curl} />
              </div>
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                No request was made. <code>access_token</code> is shown as a placeholder — the real token never leaves
                the server. Replace it yourself if you want to run the curl command manually.
              </p>
            </Card>

            {preview.hashed.length > 0 ? (
              <Card title="Hashing applied">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="py-2 pr-3 font-semibold">Field</th>
                        <th className="py-2 pr-3 font-semibold">Raw</th>
                        <th className="py-2 pr-3 font-semibold">Normalized</th>
                        <th className="py-2 font-semibold">SHA-256</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.hashed.map((row) => (
                        <tr key={row.field} className="border-b border-slate-100 last:border-0">
                          <td className="py-2 pr-3 text-slate-700">{row.field}</td>
                          <td className="py-2 pr-3 font-mono text-slate-500">{row.raw}</td>
                          <td className="py-2 pr-3 font-mono text-slate-500">{row.normalized}</td>
                          <td className="py-2 font-mono text-slate-400" title={row.hashed}>
                            {row.hashed.slice(0, 16)}…
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : null}

            {preview.warnings.length > 0 ? (
              <Card title="Warnings">
                <ul className="flex flex-col gap-2">
                  {preview.warnings.map((warning) => (
                    <li key={warning} className="flex gap-2 text-xs text-amber-700">
                      <ShieldAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </>
        ) : (
          <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <FileJson className="size-6 text-slate-300" strokeWidth={1.5} />
            <p className="text-sm text-slate-400">
              Fill in the form and hit <span className="font-medium text-slate-500">Build payload</span> to see the
              exact JSON that would be posted to Meta.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
