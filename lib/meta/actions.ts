"use server";

import { revalidatePath } from "next/cache";

import { verifyAdminSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { syncAllMetaAdAccounts } from "@/lib/meta/sync";
import { buildCapiPayload, type CapiPayloadPreview } from "@/lib/meta/capi-payload";
import {
  ACTION_SOURCES,
  CAPI_EVENT_TYPES,
  SESSION_QUALITY_GRADES,
  type ManualCapiOptions,
  type ManualSessionCapiOptions,
} from "@/lib/meta/capi-constants";
import {
  previewManualConversionEvent,
  previewSessionConversionEvent,
  sendManualConversionEvent,
  sendSessionConversionEvent,
  sendSessionConversionEventsBulk,
  type BulkSessionCapiResult,
  type ManualCapiPreview,
  type ManualCapiResult,
} from "@/lib/meta/capi";

export async function triggerMetaSync() {
  await verifyAdminSession();
  await syncAllMetaAdAccounts();
  revalidatePath("/admin/campaigns");
}

export async function disconnectMetaAdAccount(accountId: string) {
  await verifyAdminSession();
  await prisma.metaAdAccount.update({
    where: { id: accountId },
    data: { accessToken: null, tokenExpiresAt: null },
  });
  revalidatePath("/admin/campaigns");
}

export type CapiPreviewState = {
  preview?: CapiPayloadPreview;
  error?: string;
};

function field(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Builds the Conversions API payload for the admin console and returns it for
 * display. This is a DRY RUN: it deliberately performs no network request, so
 * nothing reaches Meta and no ad delivery or attribution is affected.
 */
export async function previewCapiEvent(
  _prevState: CapiPreviewState,
  formData: FormData,
): Promise<CapiPreviewState> {
  await verifyAdminSession();

  const eventName = field(formData, "eventName");
  if (!eventName) return { error: "Event name is required." };

  const actionSource = field(formData, "actionSource") ?? "website";
  if (!(ACTION_SOURCES as readonly string[]).includes(actionSource)) {
    return { error: `Unsupported action_source: ${actionSource}` };
  }

  const rawEventTime = field(formData, "eventTime");
  let eventTime = Math.floor(Date.now() / 1000);
  if (rawEventTime) {
    const parsed = new Date(rawEventTime);
    if (Number.isNaN(parsed.getTime())) {
      return { error: "Event time is not a valid date." };
    }
    eventTime = Math.floor(parsed.getTime() / 1000);
  }

  const rawValue = field(formData, "value");
  let value: number | undefined;
  if (rawValue !== undefined) {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return { error: "Value must be a number." };
    value = parsed;
  }

  const preview = buildCapiPayload({
    eventName,
    actionSource,
    eventId: field(formData, "eventId") ?? "",
    eventTime,
    eventSourceUrl: field(formData, "eventSourceUrl"),
    user: {
      email: field(formData, "email"),
      phone: field(formData, "phone"),
      firstName: field(formData, "firstName"),
      lastName: field(formData, "lastName"),
      city: field(formData, "city"),
      state: field(formData, "state"),
      zip: field(formData, "zip"),
      country: field(formData, "country"),
      externalId: field(formData, "externalId"),
      clientIpAddress: field(formData, "clientIpAddress"),
      clientUserAgent: field(formData, "clientUserAgent"),
      fbc: field(formData, "fbc"),
      fbp: field(formData, "fbp"),
    },
    custom: {
      value,
      currency: field(formData, "currency"),
      contentName: field(formData, "contentName"),
      leadSource: field(formData, "leadSource"),
    },
    includeTestEventCode: formData.get("includeTestEventCode") === "on",
  });

  return { preview };
}

// ---------------------------------------------------------------------------
// Manual send from /admin/leads
// ---------------------------------------------------------------------------

/**
 * Server actions are public POST endpoints, so the client's options are
 * re-validated here rather than trusted from the modal's own state.
 */
function parseManualOptions(raw: ManualCapiOptions): ManualCapiOptions | { error: string } {
  const eventType = CAPI_EVENT_TYPES.find((type) => type.value === raw?.eventType)?.value;
  if (!eventType) return { error: "Pick an event type." };

  if (raw.value !== undefined && !Number.isFinite(raw.value)) {
    return { error: "Value must be a number." };
  }
  if (typeof raw.value === "number" && raw.value < 0) {
    return { error: "Value cannot be negative." };
  }

  return {
    eventType,
    customEventName: typeof raw.customEventName === "string" ? raw.customEventName : undefined,
    value: typeof raw.value === "number" ? raw.value : undefined,
    currency: typeof raw.currency === "string" ? raw.currency : undefined,
    orderId: typeof raw.orderId === "string" ? raw.orderId : undefined,
  };
}

/** Builds the payload preview shown in the modal. Sends nothing. */
export async function previewManualCapiEvent(
  leadId: string,
  options: ManualCapiOptions,
): Promise<ManualCapiPreview | { error: string }> {
  await verifyAdminSession();

  const parsed = parseManualOptions(options);
  if ("error" in parsed) return parsed;

  return previewManualConversionEvent(leadId, parsed);
}

/** Fires the conversion event the modal composed. */
export async function sendManualCapiEvent(
  leadId: string,
  options: ManualCapiOptions,
): Promise<ManualCapiResult> {
  await verifyAdminSession();

  const parsed = parseManualOptions(options);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const result = await sendManualConversionEvent(leadId, parsed);
  if (result.ok && !result.preview) {
    revalidatePath("/admin/leads");
  }
  return result;
}

// ---------------------------------------------------------------------------
// Session quality grading (/admin/sessions)
// ---------------------------------------------------------------------------

/** Hard cap on one bulk send, so a runaway selection can't be posted blindly. */
const MAX_BULK_SESSIONS = 500;

function parseSessionOptions(
  raw: ManualSessionCapiOptions,
): ManualSessionCapiOptions | { error: string } {
  const base = parseManualOptions(raw);
  if ("error" in base) return base;

  const quality = SESSION_QUALITY_GRADES.find((grade) => grade.value === raw?.quality)?.value;
  if (!quality) return { error: "Pick a quality grade." };

  return { ...base, quality };
}

/** Re-reads only ids that are actually strings, so a malformed array can't widen the query. */
function parseSessionIds(raw: unknown): string[] | { error: string } {
  if (!Array.isArray(raw)) return { error: "No sessions selected." };

  const ids = [...new Set(raw.filter((id): id is string => typeof id === "string" && id.length > 0))];
  if (ids.length === 0) return { error: "No sessions selected." };
  if (ids.length > MAX_BULK_SESSIONS) {
    return { error: `Select at most ${MAX_BULK_SESSIONS} sessions at a time.` };
  }
  return ids;
}

/** Builds the payload preview shown in the session modal. Sends nothing. */
export async function previewSessionCapiEvent(
  sessionId: string,
  options: ManualSessionCapiOptions,
): Promise<ManualCapiPreview | { error: string }> {
  await verifyAdminSession();

  const parsed = parseSessionOptions(options);
  if ("error" in parsed) return parsed;

  return previewSessionConversionEvent(sessionId, parsed);
}

/** Fires a graded conversion for one session. */
export async function sendSessionCapiEvent(
  sessionId: string,
  options: ManualSessionCapiOptions,
): Promise<ManualCapiResult> {
  await verifyAdminSession();

  const parsed = parseSessionOptions(options);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const result = await sendSessionConversionEvent(sessionId, parsed);
  if (result.ok && !result.preview) {
    revalidatePath("/admin/sessions");
  }
  return result;
}

/** Grades and reports a batch of selected sessions under one shared grade. */
export async function sendSessionCapiEventsBulk(
  sessionIds: string[],
  options: ManualSessionCapiOptions,
): Promise<BulkSessionCapiResult | { error: string }> {
  await verifyAdminSession();

  const ids = parseSessionIds(sessionIds);
  if ("error" in ids) return ids;

  const parsed = parseSessionOptions(options);
  if ("error" in parsed) return parsed;

  const result = await sendSessionConversionEventsBulk(ids, parsed);
  if (result.sent > 0 && !result.preview) {
    revalidatePath("/admin/sessions");
  }
  return result;
}
