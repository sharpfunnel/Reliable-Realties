import "server-only";

import { createHash } from "node:crypto";

import type { Lead } from "@/generated/prisma/client";
import {
  CUSTOM_EVENT_NAME_PATTERN,
  DEFAULT_SESSION_EVENT_NAME,
  qualityGrade,
  type ManualCapiOptions,
  type ManualSessionCapiOptions,
} from "@/lib/meta/capi-constants";

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

/**
 * Country code prepended to bare national phone numbers before hashing.
 * `lib/validation.ts` accepts exactly ten digits, so every number the public
 * form stores is national-format and would otherwise hash to a value Meta can
 * never match.
 */
export const DEFAULT_PHONE_COUNTRY_CODE =
  process.env.META_PHONE_COUNTRY_CODE?.replace(/[^0-9]/g, "") || "91";

/**
 * Meta matches phone numbers on the full international number, digits only,
 * country code included. Getting this wrong is silent: the hash is still valid,
 * it just never collides with anything, and the event lands unmatched.
 */
export function normalizePhoneForHash(value: string): string {
  const raw = value.trim();
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";

  // A leading + or 00 means the number is already international.
  if (raw.startsWith("+")) return digits;
  if (digits.startsWith("00")) return digits.slice(2);

  // Ten digits or fewer is a national number. Longer is ambiguous — it may
  // already carry a country code — so leave it exactly as entered.
  if (digits.length <= 10) return `${DEFAULT_PHONE_COUNTRY_CODE}${digits}`;
  return digits;
}

// ---------------------------------------------------------------------------
// Live sender payload
// ---------------------------------------------------------------------------

export type LeadWithSession = Lead & {
  session?: {
    fbclid: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    fbp: string | null;
    fbc: string | null;
  } | null;
};

/** Everything the live sender reads off a lead. Keep in step with `LeadWithSession`. */
export const LIVE_LEAD_SESSION_SELECT = {
  fbclid: true,
  ipAddress: true,
  userAgent: true,
  fbp: true,
  fbc: true,
} as const;

/**
 * Resolves the `fbc` click identifier for a session.
 *
 * The `_fbc` cookie is authoritative: the pixel writes it at click time, so it
 * carries the real click timestamp. Synthesizing one from a stored `fbclid` is
 * the fallback for sessions that predate cookie capture or blocked the pixel —
 * `createdAt` is the closest honest stand-in for a timestamp we never recorded.
 */
export function resolveFbc(
  session: { fbc: string | null; fbclid: string | null } | null | undefined,
  fallbackTime: Date,
): string | undefined {
  if (session?.fbc) return session.fbc;
  if (session?.fbclid) return `fb.1.${fallbackTime.getTime()}.${session.fbclid}`;
  return undefined;
}

/**
 * The exact body `sendLeadConversionEvent` POSTs.
 */
export function buildLeadEventBody(lead: LeadWithSession, accessToken: string) {
  const userData: Record<string, unknown> = {};
  if (lead.email) userData.em = [sha256(lead.email)];
  if (lead.phone) userData.ph = [sha256(normalizePhoneForHash(lead.phone))];
  // external_id lets Meta tie repeat events for the same lead together even
  // when every other identifier fails to match.
  userData.external_id = [sha256(lead.id)];
  if (lead.session?.ipAddress) userData.client_ip_address = lead.session.ipAddress;
  if (lead.session?.userAgent) userData.client_user_agent = lead.session.userAgent;
  if (lead.session?.fbp) userData.fbp = lead.session.fbp;

  const fbc = resolveFbc(lead.session, lead.createdAt);
  if (fbc) userData.fbc = fbc;

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
  hashInto("ph", "phone", input.user.phone, normalizePhoneForHash);
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
    const normalized = normalizePhoneForHash(input.user.phone);
    if (normalized.length < 10) {
      warnings.push(
        `Phone normalizes to "${normalized}", which is too short to be a valid international number. It will hash to a value that never matches.`,
      );
    } else if (digitsOnly(input.user.phone).length <= 10 && !input.user.phone.trim().startsWith("+")) {
      warnings.push(
        `Phone had no country code, so "${DEFAULT_PHONE_COUNTRY_CODE}" was prepended before hashing (normalized: ${normalized}). Set META_PHONE_COUNTRY_CODE if this is the wrong country.`,
      );
    }
  }
  if (!input.user.fbc?.trim() && !input.user.fbp?.trim()) {
    warnings.push(
      "No fbc or fbp. Match quality will be low. Both are read from the pixel's _fbp/_fbc cookies at session ingest, so this lead either predates cookie capture or blocked the pixel.",
    );
  }
  if (!input.user.clientUserAgent?.trim()) {
    warnings.push(
      "No client_user_agent. Meta pairs it with client_ip_address as a fallback identifier, so sending the IP alone wastes most of that signal.",
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
  session: {
    select: {
      ipAddress: true,
      fbclid: true,
      entryPath: true,
      userAgent: true,
      fbp: true,
      fbc: true,
    },
  },
} as const;

export type ManualCapiLead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  createdAt: Date;
  visitor?: { city: string | null; region: string | null; country: string | null } | null;
  session?: {
    ipAddress: string | null;
    fbclid: string | null;
    entryPath: string | null;
    userAgent: string | null;
    fbp: string | null;
    fbc: string | null;
  } | null;
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
      clientUserAgent: lead.session?.userAgent ?? undefined,
      fbp: lead.session?.fbp ?? undefined,
      fbc: resolveFbc(lead.session, lead.createdAt),
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

// ---------------------------------------------------------------------------
// Session quality payload (the "Send" flow on /admin/sessions)
// ---------------------------------------------------------------------------

/** Everything the session sender reads off a session, in one place. */
export const MANUAL_SESSION_SELECT = {
  id: true,
  startedAt: true,
  entryPath: true,
  ipAddress: true,
  userAgent: true,
  fbp: true,
  fbc: true,
  fbclid: true,
  utmSource: true,
  visitor: { select: { city: true, region: true, country: true } },
  // Most sessions have no lead; the newest one is the best identity available
  // when they do, because a later submission has the corrected contact details.
  leads: {
    select: { id: true, name: true, email: true, phone: true },
    orderBy: { createdAt: "desc" },
    take: 1,
  },
} as const;

export type ManualCapiSession = {
  id: string;
  startedAt: Date;
  entryPath: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  fbp: string | null;
  fbc: string | null;
  fbclid: string | null;
  utmSource: string | null;
  visitor?: { city: string | null; region: string | null; country: string | null } | null;
  leads?: { id: string; name: string | null; email: string | null; phone: string | null }[];
};

/**
 * The identifiers Meta could actually match this session on, most valuable
 * first. Used both to gate sending and to explain in the UI why a session
 * cannot be sent.
 *
 * IP and user agent are deliberately excluded. Meta accepts them, but on their
 * own they identify a household at best, and an event carrying nothing else is
 * overwhelmingly likely to go unmatched — which drags the dataset's Event Match
 * Quality down while reporting a conversion nobody can attribute.
 */
export function sessionMatchIdentifiers(session: ManualCapiSession): string[] {
  const found: string[] = [];
  const lead = session.leads?.[0];

  if (lead?.email) found.push("email");
  if (lead?.phone) found.push("phone");
  if (session.fbc || session.fbclid) found.push("fbc");
  if (session.fbp) found.push("fbp");

  return found;
}

/** A session is sendable when Meta has at least one way to identify the person. */
export function sessionIsMatchable(session: ManualCapiSession): boolean {
  return sessionMatchIdentifiers(session).length > 0;
}

export function resolveSessionEventName(options: ManualSessionCapiOptions) {
  if (options.eventType !== "Custom") return options.eventType;
  const name = options.customEventName?.trim() || DEFAULT_SESSION_EVENT_NAME;
  if (!CUSTOM_EVENT_NAME_PATTERN.test(name)) {
    throw new ManualCapiInputError(
      "Custom event names may only contain letters, numbers and underscores (max 50 characters).",
    );
  }
  return name;
}

/**
 * Turns a graded session into the same `CapiEventInput` every other path
 * builds, so the preview, the single send and the bulk send all go through
 * `buildCapiPayload` and cannot drift apart.
 *
 * `event_time` is *now* rather than `startedAt`: Meta rejects events older than
 * seven days, and grading is something an operator does days after the visit.
 * The conversion is being reported when they judge it, which is today.
 */
export function buildSessionCapiInput(
  session: ManualCapiSession,
  options: ManualSessionCapiOptions,
  now = new Date(),
): CapiEventInput {
  const grade = qualityGrade(options.quality);
  if (!grade) throw new ManualCapiInputError("Pick a quality grade.");

  const lead = session.leads?.[0];
  const [firstName, ...rest] = (lead?.name ?? "").trim().split(/\s+/).filter(Boolean);

  // An explicit value overrides the grade, so an operator who knows a session
  // is worth more than its band can say so without inventing a fourth grade.
  const value = typeof options.value === "number" && Number.isFinite(options.value)
    ? options.value
    : grade.conversionValue;
  const currency = options.currency?.trim() || "INR";

  return {
    eventName: resolveSessionEventName(options),
    actionSource: "website",
    // Dedup key. Meta dedups on the (event_name, event_id) pair, so re-grading
    // and re-sending the same event collapses into one conversion instead of
    // stacking, while a different event type for the same session still counts.
    eventId: options.orderId?.trim() || session.id,
    eventTime: Math.floor(now.getTime() / 1000),
    eventSourceUrl: session.entryPath ?? undefined,
    user: {
      email: lead?.email ?? undefined,
      phone: lead?.phone ?? undefined,
      firstName: firstName ?? undefined,
      lastName: rest.length > 0 ? rest.join(" ") : undefined,
      city: session.visitor?.city ?? undefined,
      state: session.visitor?.region ?? undefined,
      country: session.visitor?.country ?? undefined,
      externalId: session.id,
      clientIpAddress: session.ipAddress ?? undefined,
      clientUserAgent: session.userAgent ?? undefined,
      fbp: session.fbp ?? undefined,
      fbc: resolveFbc(session, session.startedAt),
    },
    custom: {
      value,
      currency,
      contentName: grade.label,
      leadSource: session.utmSource ?? undefined,
      orderId: options.orderId?.trim() || undefined,
    },
    includeTestEventCode: Boolean(process.env.META_CAPI_TEST_EVENT_CODE),
  };
}
