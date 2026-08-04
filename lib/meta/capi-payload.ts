import "server-only";

import { createHash } from "node:crypto";

import type { Lead } from "@/generated/prisma/client";
import { CUSTOM_EVENT_NAME_PATTERN, type ManualCapiOptions } from "@/lib/meta/capi-constants";

/**
 * Shared construction of Meta Conversions API payloads.
 *
 * Both the live sender (`lib/meta/capi.ts`) and the admin dry-run console
 * (`/admin/meta-capi`) build their bodies here. That is the whole point of this
 * module: if the console built its own payload, the JSON it shows would slowly
 * drift away from the JSON we actually send, and the console would be lying.
 */

export function graphVersion() {
  return process.env.META_GRAPH_API_VERSION || "v21.0";
}

export function sha256(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export function eventsEndpoint(pixelId: string) {
  return `https://graph.facebook.com/${graphVersion()}/${pixelId}/events`;
}

// ---------------------------------------------------------------------------
// Live sender payload
// ---------------------------------------------------------------------------

export type LeadWithSession = Lead & {
  session?: { fbclid: string | null; ipAddress: string | null } | null;
};

/**
 * The exact body `sendLeadConversionEvent` POSTs. Extracted verbatim — key
 * order and field selection are unchanged, so the emitted JSON is identical to
 * what this integration has always sent.
 */
export function buildLeadEventBody(lead: LeadWithSession, accessToken: string) {
  const userData: Record<string, unknown> = {};
  if (lead.email) userData.em = [sha256(lead.email)];
  if (lead.phone) userData.ph = [sha256(lead.phone.replace(/[^0-9]/g, ""))];
  if (lead.session?.ipAddress) userData.client_ip_address = lead.session.ipAddress;
  if (lead.session?.fbclid) {
    userData.fbc = `fb.1.${Date.now()}.${lead.session.fbclid}`;
  }

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(lead.createdAt.getTime() / 1000),
        action_source: "website",
        event_id: lead.id,
        user_data: userData,
        custom_data: {
          value: 0,
          currency: "INR",
          lead_source: lead.source ?? undefined,
        },
      },
    ],
    access_token: accessToken,
  };
  if (process.env.META_CAPI_TEST_EVENT_CODE) {
    body.test_event_code = process.env.META_CAPI_TEST_EVENT_CODE;
  }

  return body;
}

// ---------------------------------------------------------------------------
// Console payload (dry run)
// ---------------------------------------------------------------------------

export type CapiUserInput = {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  externalId?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbc?: string;
  fbp?: string;
};

export type CapiEventInput = {
  eventName: string;
  actionSource: string;
  eventId: string;
  eventTime: number; // unix seconds
  eventSourceUrl?: string;
  user: CapiUserInput;
  custom: {
    value?: number;
    currency?: string;
    contentName?: string;
    leadSource?: string;
    orderId?: string;
  };
  includeTestEventCode: boolean;
};

export type HashedField = {
  field: string;
  raw: string;
  normalized: string;
  hashed: string;
};

export type CapiPayloadPreview = {
  endpoint: string;
  pixelIdSet: boolean;
  /** `access_token` is always the literal `<ACCESS_TOKEN>` — never the real value. */
  body: Record<string, unknown>;
  hashed: HashedField[];
  warnings: string[];
};

export const ACCESS_TOKEN_PLACEHOLDER = "<ACCESS_TOKEN>";

/** Meta's documented normalization: lowercase, trimmed, whitespace removed. */
function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function digitsOnly(value: string) {
  return value.replace(/[^0-9]/g, "");
}

/**
 * Builds the JSON that *would* be POSTed to Meta. This function performs no
 * network I/O of any kind — the console is a dry run by design.
 */
export function buildCapiPayload(input: CapiEventInput): CapiPayloadPreview {
  const warnings: string[] = [];
  const hashed: HashedField[] = [];

  const pixelId = process.env.META_PIXEL_ID;
  const userData: Record<string, unknown> = {};

  function hashInto(key: string, label: string, raw: string | undefined, normalize: (v: string) => string) {
    const value = raw?.trim();
    if (!value) return;
    const normalized = normalize(value);
    if (!normalized) return;
    const digest = sha256(normalized);
    userData[key] = [digest];
    hashed.push({ field: label, raw: value, normalized, hashed: digest });
  }

  hashInto("em", "email", input.user.email, (v) => v.trim().toLowerCase());
  hashInto("ph", "phone", input.user.phone, digitsOnly);
  hashInto("fn", "first name", input.user.firstName, normalizeText);
  hashInto("ln", "last name", input.user.lastName, normalizeText);
  hashInto("ct", "city", input.user.city, normalizeText);
  hashInto("st", "state", input.user.state, normalizeText);
  hashInto("zp", "zip", input.user.zip, normalizeText);
  hashInto("country", "country", input.user.country, normalizeText);
  hashInto("external_id", "external_id", input.user.externalId, (v) => v.trim().toLowerCase());

  // Sent unhashed, per Meta's spec.
  if (input.user.clientIpAddress?.trim()) userData.client_ip_address = input.user.clientIpAddress.trim();
  if (input.user.clientUserAgent?.trim()) userData.client_user_agent = input.user.clientUserAgent.trim();
  if (input.user.fbc?.trim()) userData.fbc = input.user.fbc.trim();
  if (input.user.fbp?.trim()) userData.fbp = input.user.fbp.trim();

  const customData: Record<string, unknown> = {};
  if (typeof input.custom.value === "number" && Number.isFinite(input.custom.value)) {
    customData.value = input.custom.value;
  }
  if (input.custom.currency?.trim()) customData.currency = input.custom.currency.trim().toUpperCase();
  if (input.custom.contentName?.trim()) customData.content_name = input.custom.contentName.trim();
  if (input.custom.leadSource?.trim()) customData.lead_source = input.custom.leadSource.trim();
  if (input.custom.orderId?.trim()) customData.order_id = input.custom.orderId.trim();

  const event: Record<string, unknown> = {
    event_name: input.eventName,
    event_time: input.eventTime,
    action_source: input.actionSource,
  };
  if (input.eventId.trim()) event.event_id = input.eventId.trim();
  if (input.eventSourceUrl?.trim()) event.event_source_url = input.eventSourceUrl.trim();
  event.user_data = userData;
  if (Object.keys(customData).length > 0) event.custom_data = customData;

  const body: Record<string, unknown> = {
    data: [event],
    access_token: ACCESS_TOKEN_PLACEHOLDER,
  };
  if (input.includeTestEventCode) {
    body.test_event_code = process.env.META_CAPI_TEST_EVENT_CODE || "<META_CAPI_TEST_EVENT_CODE>";
  }

  // --- Warnings -----------------------------------------------------------
  if (!pixelId) {
    warnings.push("META_PIXEL_ID is not set — the live sender exits early and sends nothing at all.");
  }
  if (Object.keys(userData).length === 0) {
    warnings.push("user_data is empty. Meta will reject the event — at least one identifier is required.");
  }
  if (!input.eventId.trim()) {
    warnings.push("event_id is blank, so this event cannot be deduplicated against a browser pixel event.");
  }
  if (input.user.phone?.trim()) {
    const digits = digitsOnly(input.user.phone);
    if (digits.length <= 10) {
      warnings.push(
        `Phone "${digits}" has no country code. Meta matches on the full international number, so this will hash to a value that never matches. Note: the live sender in lib/meta/capi.ts has the same behaviour.`,
      );
    }
  }
  if (!input.user.fbc?.trim() && !input.user.fbp?.trim()) {
    warnings.push(
      "No fbc or fbp. Match quality will be low. The site has no Meta Pixel installed, so _fbp is never captured, and the live sender synthesizes fbc from fbclid using the send time rather than the real click time.",
    );
  }
  if (input.includeTestEventCode && !process.env.META_CAPI_TEST_EVENT_CODE) {
    warnings.push("META_CAPI_TEST_EVENT_CODE is not set — a placeholder is shown instead.");
  }
  if (input.eventName === "Purchase" && typeof customData.value !== "number") {
    warnings.push("Purchase events require custom_data.value and custom_data.currency.");
  }
  if (input.eventTime * 1000 < Date.now() - 7 * 24 * 60 * 60 * 1000) {
    warnings.push("event_time is more than 7 days old. Meta rejects events older than 7 days.");
  }

  return {
    endpoint: eventsEndpoint(pixelId || "<META_PIXEL_ID>"),
    pixelIdSet: Boolean(pixelId),
    body,
    hashed,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Manual send payload (the "Send" modal on /admin/leads)
// ---------------------------------------------------------------------------

/** Everything the manual sender reads off a lead, in one place. */
export const MANUAL_LEAD_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  source: true,
  createdAt: true,
  visitor: { select: { city: true, region: true, country: true } },
  session: { select: { ipAddress: true, fbclid: true, entryPath: true } },
} as const;

export type ManualCapiLead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  createdAt: Date;
  visitor?: { city: string | null; region: string | null; country: string | null } | null;
  session?: { ipAddress: string | null; fbclid: string | null; entryPath: string | null } | null;
};

/** Thrown for operator input the modal should surface, not a server fault. */
export class ManualCapiInputError extends Error {}

export function resolveManualEventName(options: ManualCapiOptions) {
  if (options.eventType !== "Custom") return options.eventType;

  const name = options.customEventName?.trim() ?? "";
  if (!name) throw new ManualCapiInputError("Enter a custom event name.");
  if (!CUSTOM_EVENT_NAME_PATTERN.test(name)) {
    throw new ManualCapiInputError(
      "Custom event names may only contain letters, numbers and underscores (max 50 characters).",
    );
  }
  return name;
}

/**
 * Turns a lead + the modal's choices into the same `CapiEventInput` the console
 * builds, so the manual send goes through `buildCapiPayload` like everything
 * else. The preview the operator approves is byte-for-byte the body we POST,
 * minus the access token.
 *
 * `event_time` is *now*, not `lead.createdAt`: a manual send records a
 * conversion that happened when the admin says it did, and Meta rejects events
 * older than seven days — most leads worth converting by hand are older.
 */
export function buildManualCapiInput(
  lead: ManualCapiLead,
  options: ManualCapiOptions,
  now = new Date(),
): CapiEventInput {
  const [firstName, ...rest] = (lead.name ?? "").trim().split(/\s+/).filter(Boolean);

  const currency = options.currency?.trim();
  const hasValue = typeof options.value === "number" && Number.isFinite(options.value);
  if (hasValue && !currency) {
    throw new ManualCapiInputError("A conversion value needs a currency.");
  }

  return {
    eventName: resolveManualEventName(options),
    actionSource: "website",
    // Dedup key. Falling back to the lead id means re-sending the same event
    // type for a lead collapses into one conversion rather than double-counting.
    eventId: options.orderId?.trim() || lead.id,
    eventTime: Math.floor(now.getTime() / 1000),
    eventSourceUrl: lead.session?.entryPath ?? undefined,
    user: {
      email: lead.email ?? undefined,
      phone: lead.phone ?? undefined,
      firstName: firstName ?? undefined,
      lastName: rest.length > 0 ? rest.join(" ") : undefined,
      city: lead.visitor?.city ?? undefined,
      state: lead.visitor?.region ?? undefined,
      country: lead.visitor?.country ?? undefined,
      externalId: lead.id,
      clientIpAddress: lead.session?.ipAddress ?? undefined,
      // Matches how sendLeadConversionEvent synthesizes fbc from a stored
      // fbclid: the real click timestamp was never captured.
      fbc: lead.session?.fbclid ? `fb.1.${lead.createdAt.getTime()}.${lead.session.fbclid}` : undefined,
    },
    custom: {
      value: hasValue ? options.value : undefined,
      currency: hasValue ? currency : undefined,
      leadSource: lead.source ?? undefined,
      orderId: options.orderId?.trim() || undefined,
    },
    includeTestEventCode: Boolean(process.env.META_CAPI_TEST_EVENT_CODE),
  };
}
