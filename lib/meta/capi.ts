import "server-only";

import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/db";
import type { ManualCapiOptions, ManualSessionCapiOptions } from "@/lib/meta/capi-constants";
import {
  buildCapiPayload,
  buildManualCapiInput,
  buildSessionCapiInput,
  eventsEndpoint,
  buildLeadEventBody,
  ManualCapiInputError,
  MANUAL_LEAD_SELECT,
  MANUAL_SESSION_SELECT,
  resolveSessionEventName,
  sessionIsMatchable,
  type LeadWithSession,
} from "@/lib/meta/capi-payload";

async function resolveAccessToken(): Promise<string | null> {
  if (process.env.META_CAPI_ACCESS_TOKEN) {
    return process.env.META_CAPI_ACCESS_TOKEN;
  }
  const account = await prisma.metaAdAccount.findFirst({
    where: { accessToken: { not: null } },
    orderBy: { connectedAt: "desc" },
  });
  return account?.accessToken ?? null;
}

/**
 * Sends a server-side "Lead" event to Meta's Conversions API for a newly
 * created Lead row. A CAPI failure must never fail the lead submission
 * itself — callers should invoke this fire-and-forget.
 */
export async function sendLeadConversionEvent(lead: LeadWithSession) {
  const pixelId = process.env.META_PIXEL_ID;
  if (!pixelId) return;

  try {
    const accessToken = await resolveAccessToken();
    if (!accessToken) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { metaCapiError: "No Meta access token available (CAPI or connected ad account)." },
      });
      return;
    }

    const body = buildLeadEventBody(lead, accessToken);

    const res = await fetch(eventsEndpoint(pixelId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      await prisma.lead.update({
        where: { id: lead.id },
        data: { metaCapiError: `HTTP ${res.status}: ${text.slice(0, 500)}` },
      });
      return;
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: { metaCapiSentAt: new Date(), metaCapiError: null },
    });
  } catch (error) {
    await prisma.lead
      .update({
        where: { id: lead.id },
        data: { metaCapiError: error instanceof Error ? error.message : "Unknown CAPI error" },
      })
      .catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Manual send
// ---------------------------------------------------------------------------

export type ManualCapiPreview = {
  endpoint: string;
  /** `access_token` is the literal `<ACCESS_TOKEN>` — the real one stays server-side. */
  body: Record<string, unknown>;
  warnings: string[];
  eventName: string;
  eventId: string;
};

export type ManualCapiResult =
  | {
      ok: true;
      /** `evt_preview_…` when this was a dev-only dry run. */
      eventId: string;
      eventName: string;
      /** True when no credentials were configured and nothing left the server. */
      preview: boolean;
      /** Meta's trace id, for looking the delivery up in Events Manager. */
      fbtraceId?: string;
      eventsReceived?: number;
    }
  | { ok: false; error: string };

function credentialsMissingMessage(pixelId: string | undefined) {
  return pixelId
    ? "No Meta access token available (set META_CAPI_ACCESS_TOKEN or connect an ad account)."
    : "META_PIXEL_ID is not set, so there is no pixel to send this event to.";
}

async function loadManualLead(leadId: string) {
  return prisma.lead.findUnique({ where: { id: leadId }, select: MANUAL_LEAD_SELECT });
}

/**
 * Builds — but never sends — the payload for a manual conversion, so the modal
 * can show the operator exactly what they are about to fire.
 */
export async function previewManualConversionEvent(
  leadId: string,
  options: ManualCapiOptions,
): Promise<ManualCapiPreview | { error: string }> {
  const lead = await loadManualLead(leadId);
  if (!lead) return { error: "Lead not found." };

  try {
    const input = buildManualCapiInput(lead, options);
    const preview = buildCapiPayload(input);
    return {
      endpoint: preview.endpoint,
      body: preview.body,
      warnings: preview.warnings,
      eventName: input.eventName,
      eventId: input.eventId,
    };
  } catch (error) {
    if (error instanceof ManualCapiInputError) return { error: error.message };
    throw error;
  }
}

/**
 * Fires an admin-chosen conversion event for an existing lead. Unlike
 * `sendLeadConversionEvent` this is user-initiated and its outcome is shown in
 * the UI, so it reports errors by returning them rather than swallowing them —
 * while still recording the result on the lead, so the leads table's
 * Sent/Failed badge reflects whichever send fired most recently.
 */
export async function sendManualConversionEvent(
  leadId: string,
  options: ManualCapiOptions,
): Promise<ManualCapiResult> {
  const lead = await loadManualLead(leadId);
  if (!lead) return { ok: false, error: "Lead not found." };

  let body: Record<string, unknown>;
  let eventName: string;
  let eventId: string;
  try {
    const input = buildManualCapiInput(lead, options);
    body = buildCapiPayload(input).body;
    eventName = input.eventName;
    eventId = input.eventId;
  } catch (error) {
    if (error instanceof ManualCapiInputError) return { ok: false, error: error.message };
    throw error;
  }

  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = pixelId ? await resolveAccessToken() : null;

  if (!pixelId || !accessToken) {
    // Dev-only affordance: let the whole flow be exercised before Meta
    // credentials exist. Nothing is sent and the lead is left untouched, so
    // this can never masquerade as a real delivery in the leads table.
    if (process.env.NODE_ENV !== "production") {
      return {
        ok: true,
        preview: true,
        eventName,
        eventId: `evt_preview_${randomUUID().slice(0, 8)}`,
      };
    }
    return { ok: false, error: credentialsMissingMessage(pixelId) };
  }

  body.access_token = accessToken;

  try {
    const res = await fetch(eventsEndpoint(pixelId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();

    if (!res.ok) {
      const message = `HTTP ${res.status}: ${text.slice(0, 500)}`;
      await prisma.lead
        .update({ where: { id: lead.id }, data: { metaCapiError: message } })
        .catch(() => {});
      return { ok: false, error: message };
    }

    let parsed: { events_received?: number; fbtrace_id?: string } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      // A 200 with an unparseable body still counts as delivered.
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: { metaCapiSentAt: new Date(), metaCapiError: null },
    });

    return {
      ok: true,
      preview: false,
      eventName,
      eventId,
      fbtraceId: parsed.fbtrace_id,
      eventsReceived: parsed.events_received,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown CAPI error";
    await prisma.lead
      .update({ where: { id: lead.id }, data: { metaCapiError: message } })
      .catch(() => {});
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Session quality send
// ---------------------------------------------------------------------------

/**
 * Events per POST when sending a batch. Meta accepts up to 1000 in one `data`
 * array; 100 keeps a single failed request from taking a large selection down
 * with it, since Meta rejects a malformed batch as a whole.
 */
const BULK_CHUNK_SIZE = 100;

export type BulkSessionCapiResult = {
  sent: number;
  failed: number;
  /** Sessions Meta could not have matched, with the reason, left untouched. */
  skipped: { id: string; reason: string }[];
  /** True when credentials were absent and this was a dev-only dry run. */
  preview: boolean;
  errors: string[];
};

async function loadManualSession(sessionId: string) {
  return prisma.session.findUnique({ where: { id: sessionId }, select: MANUAL_SESSION_SELECT });
}

const UNMATCHABLE_REASON =
  "No email, phone, fbp or fbc — Meta has no way to identify this visitor, so the event would be discarded.";

/**
 * Builds — but never sends — the payload for a graded session, so the modal can
 * show the operator exactly what they are about to report.
 */
export async function previewSessionConversionEvent(
  sessionId: string,
  options: ManualSessionCapiOptions,
): Promise<ManualCapiPreview | { error: string }> {
  const session = await loadManualSession(sessionId);
  if (!session) return { error: "Session not found." };
  if (!sessionIsMatchable(session)) return { error: UNMATCHABLE_REASON };

  try {
    const input = buildSessionCapiInput(session, options);
    const preview = buildCapiPayload(input);
    return {
      endpoint: preview.endpoint,
      body: preview.body,
      warnings: preview.warnings,
      eventName: input.eventName,
      eventId: input.eventId,
    };
  } catch (error) {
    if (error instanceof ManualCapiInputError) return { error: error.message };
    throw error;
  }
}

/** Records the outcome of a send on the session rows it covered. */
async function recordSessionOutcome(
  sessionIds: string[],
  data: { metaCapiQuality?: string; metaCapiEvent?: string; metaCapiSentAt?: Date | null; metaCapiError: string | null },
) {
  await prisma.session
    .updateMany({ where: { id: { in: sessionIds } }, data })
    .catch(() => {});
}

/**
 * Fires a graded conversion for one session. User-initiated, so unlike the
 * automatic lead sender it reports errors by returning them — while still
 * recording the result on the session so the table's badge stays accurate.
 */
export async function sendSessionConversionEvent(
  sessionId: string,
  options: ManualSessionCapiOptions,
): Promise<ManualCapiResult> {
  const session = await loadManualSession(sessionId);
  if (!session) return { ok: false, error: "Session not found." };
  if (!sessionIsMatchable(session)) return { ok: false, error: UNMATCHABLE_REASON };

  let body: Record<string, unknown>;
  let eventName: string;
  let eventId: string;
  try {
    const input = buildSessionCapiInput(session, options);
    body = buildCapiPayload(input).body;
    eventName = input.eventName;
    eventId = input.eventId;
  } catch (error) {
    if (error instanceof ManualCapiInputError) return { ok: false, error: error.message };
    throw error;
  }

  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = pixelId ? await resolveAccessToken() : null;

  if (!pixelId || !accessToken) {
    // Same dev-only affordance as the lead sender: exercise the flow before
    // credentials exist, without writing anything that could later be mistaken
    // for a real delivery.
    if (process.env.NODE_ENV !== "production") {
      return { ok: true, preview: true, eventName, eventId: `evt_preview_${randomUUID().slice(0, 8)}` };
    }
    return { ok: false, error: credentialsMissingMessage(pixelId) };
  }

  body.access_token = accessToken;

  try {
    const res = await fetch(eventsEndpoint(pixelId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();

    if (!res.ok) {
      const message = `HTTP ${res.status}: ${text.slice(0, 500)}`;
      await recordSessionOutcome([session.id], {
        metaCapiQuality: options.quality,
        metaCapiEvent: eventName,
        metaCapiError: message,
      });
      return { ok: false, error: message };
    }

    let parsed: { events_received?: number; fbtrace_id?: string } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      // A 200 with an unparseable body still counts as delivered.
    }

    await recordSessionOutcome([session.id], {
      metaCapiQuality: options.quality,
      metaCapiEvent: eventName,
      metaCapiSentAt: new Date(),
      metaCapiError: null,
    });

    return {
      ok: true,
      preview: false,
      eventName,
      eventId,
      fbtraceId: parsed.fbtrace_id,
      eventsReceived: parsed.events_received,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown CAPI error";
    await recordSessionOutcome([session.id], {
      metaCapiQuality: options.quality,
      metaCapiEvent: eventName,
      metaCapiError: message,
    });
    return { ok: false, error: message };
  }
}

/**
 * Grades a batch of sessions with one shared grade and reports them together.
 *
 * Unmatchable sessions are skipped rather than failed — they are a fact about
 * the traffic, not an error, and the caller shows them separately so a
 * selection that was half direct traffic doesn't read as a broken send.
 */
export async function sendSessionConversionEventsBulk(
  sessionIds: string[],
  options: ManualSessionCapiOptions,
): Promise<BulkSessionCapiResult> {
  const result: BulkSessionCapiResult = { sent: 0, failed: 0, skipped: [], preview: false, errors: [] };
  if (sessionIds.length === 0) return result;

  const sessions = await prisma.session.findMany({
    where: { id: { in: sessionIds } },
    select: MANUAL_SESSION_SELECT,
  });

  const sendable: { id: string; event: unknown }[] = [];
  for (const session of sessions) {
    if (!sessionIsMatchable(session)) {
      result.skipped.push({ id: session.id, reason: UNMATCHABLE_REASON });
      continue;
    }
    try {
      const input = buildSessionCapiInput(session, options);
      const [event] = buildCapiPayload(input).body.data as unknown[];
      sendable.push({ id: session.id, event });
    } catch (error) {
      result.failed += 1;
      result.errors.push(error instanceof Error ? error.message : "Unknown CAPI error");
    }
  }

  if (sendable.length === 0) return result;

  const eventName = resolveBulkEventName(options);
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = pixelId ? await resolveAccessToken() : null;

  if (!pixelId || !accessToken) {
    if (process.env.NODE_ENV !== "production") {
      result.preview = true;
      result.sent = sendable.length;
      return result;
    }
    result.failed += sendable.length;
    result.errors.push(credentialsMissingMessage(pixelId));
    return result;
  }

  for (let i = 0; i < sendable.length; i += BULK_CHUNK_SIZE) {
    const chunk = sendable.slice(i, i + BULK_CHUNK_SIZE);
    const body: Record<string, unknown> = {
      data: chunk.map((entry) => entry.event),
      access_token: accessToken,
    };
    if (process.env.META_CAPI_TEST_EVENT_CODE) {
      body.test_event_code = process.env.META_CAPI_TEST_EVENT_CODE;
    }

    const ids = chunk.map((entry) => entry.id);
    try {
      const res = await fetch(eventsEndpoint(pixelId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const message = `HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`;
        result.failed += ids.length;
        result.errors.push(message);
        await recordSessionOutcome(ids, {
          metaCapiQuality: options.quality,
          metaCapiEvent: eventName,
          metaCapiError: message,
        });
        continue;
      }

      result.sent += ids.length;
      await recordSessionOutcome(ids, {
        metaCapiQuality: options.quality,
        metaCapiEvent: eventName,
        metaCapiSentAt: new Date(),
        metaCapiError: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown CAPI error";
      result.failed += ids.length;
      result.errors.push(message);
      await recordSessionOutcome(ids, {
        metaCapiQuality: options.quality,
        metaCapiEvent: eventName,
        metaCapiError: message,
      });
    }
  }

  // Identical messages from every chunk read as noise; the operator needs to
  // know what went wrong, not how many times.
  result.errors = [...new Set(result.errors)];
  return result;
}

function resolveBulkEventName(options: ManualSessionCapiOptions) {
  try {
    return resolveSessionEventName(options);
  } catch {
    return options.eventType;
  }
}
