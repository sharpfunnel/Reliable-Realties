import "server-only";

import { geolocation, ipAddress } from "@vercel/functions";

import type { Session } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export type ClientDeviceInfo = {
  screenWidth?: number;
  screenHeight?: number;
  language?: string;
  timezone?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  deviceType?: string;
  network?: string;
  downlink?: number;
};

/**
 * ipAddress() from @vercel/functions only resolves on Vercel's own network
 * (it reads the x-real-ip header Vercel's edge injects). Locally — and on
 * any other host — that header doesn't exist, so we fall back to the
 * standard x-forwarded-for proxy header, and finally to the loopback
 * address so local testing still shows something instead of a blank dash.
 * On Vercel this fallback never triggers; ipAddress() resolves first.
 */
function resolveIpAddress(request: Request): string {
  const vercelIp = ipAddress(request);
  if (vercelIp) return vercelIp;

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();

  return "::1";
}

/**
 * Reads one cookie off the raw header. Only used for Meta's `_fbp`/`_fbc`,
 * whose values are dot-separated ASCII (`fb.1.<ts>.<id>`), so no percent
 * decoding is needed — and skipping it means a malformed cookie elsewhere in
 * the header can't throw inside an ingestion request.
 */
function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const value = part.slice(eq + 1).trim();
    return value.length > 0 ? value : undefined;
  }
  return undefined;
}

/**
 * The three fields Meta's Conversions API matches on that only exist on the
 * HTTP request itself — they can't be reconstructed later from anything we
 * store. `_fbp`/`_fbc` are written by the browser pixel, so on the very first
 * request of a session they may not exist yet; see the backfill in
 * `findOrCreateSession`.
 */
type MetaMatchIdentifiers = {
  userAgent?: string;
  fbp?: string;
  fbc?: string;
};

function readMetaMatchIdentifiers(request: Request): MetaMatchIdentifiers {
  return {
    userAgent: request.headers.get("user-agent")?.slice(0, 1000) || undefined,
    fbp: readCookie(request, "_fbp"),
    fbc: readCookie(request, "_fbc"),
  };
}

export type ClientSessionInit = {
  entryPath?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  gclid?: string;
  fbclid?: string;
  msclkid?: string;
  placement?: string;
  metaCampaignId?: string;
  metaAdsetId?: string;
  metaAdId?: string;
  rawParams?: Record<string, string>;
  viewportWidth?: number;
  viewportHeight?: number;
};

/**
 * Both ingestion routes can race for the same visitor/session: the beacon's
 * first flush and the lead form's own init call fire independently. On a
 * unique-constraint violation the row we wanted already exists, so re-read it
 * instead of failing the request.
 */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

const MAX_RAW_PARAMS = 50;
const MAX_RAW_PARAM_LENGTH = 500;

/**
 * Coerces the client's rawParams blob into a flat string map. It comes straight
 * off the wire into a Json column, so drop non-string values and cap both the
 * number of params and their length rather than storing whatever was posted.
 * Returns undefined when there's nothing to store, so the column stays NULL.
 */
export function sanitizeRawParams(value: unknown): Record<string, string> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .slice(0, MAX_RAW_PARAMS)
    .map(([key, val]) => [key.slice(0, MAX_RAW_PARAM_LENGTH), val.slice(0, MAX_RAW_PARAM_LENGTH)]);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * Upserts the Visitor row by fingerprint, refreshing geo/device info from the
 * current request. Shared by /api/track and /api/leads so both ingestion
 * paths agree on visitor identity.
 */
export async function upsertVisitor(
  request: Request,
  fingerprint: string,
  device: ClientDeviceInfo = {},
) {
  const geo = geolocation(request);

  const existing = await prisma.visitor.findUnique({ where: { fingerprint } });

  try {
    return await prisma.visitor.upsert({
      where: { fingerprint },
      create: {
        fingerprint,
        isReturning: false,
        country: geo.country,
        region: geo.countryRegion,
        city: geo.city,
        ...device,
      },
      update: {
        isReturning: Boolean(existing),
        country: geo.country ?? undefined,
        region: geo.countryRegion ?? undefined,
        city: geo.city ?? undefined,
        ...device,
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await prisma.visitor.findUnique({ where: { fingerprint } });
    if (!raced) throw error;
    return raced;
  }
}

export async function findOrCreateSession(
  request: Request,
  clientId: string,
  visitorId: string,
  init: ClientSessionInit = {},
) {
  const meta = readMetaMatchIdentifiers(request);

  const existing = await prisma.session.findUnique({ where: { clientId } });
  if (existing) return backfillMetaMatchIdentifiers(existing, meta);

  try {
    return await prisma.session.create({
      data: {
        clientId,
        visitorId,
        userAgent: meta.userAgent,
        fbp: meta.fbp,
        fbc: meta.fbc,
        entryPath: init.entryPath,
        referrer: init.referrer,
        utmSource: init.utmSource,
        utmMedium: init.utmMedium,
        utmCampaign: init.utmCampaign,
        utmContent: init.utmContent,
        utmTerm: init.utmTerm,
        gclid: init.gclid,
        fbclid: init.fbclid,
        msclkid: init.msclkid,
        placement: init.placement,
        metaCampaignId: init.metaCampaignId,
        metaAdsetId: init.metaAdsetId,
        metaAdId: init.metaAdId,
        // `undefined` leaves the column NULL; `{}` would write an empty-but-
        // non-null JSON value to every direct-traffic session.
        rawParams: init.rawParams && Object.keys(init.rawParams).length > 0 ? init.rawParams : undefined,
        viewportWidth: init.viewportWidth,
        viewportHeight: init.viewportHeight,
        ipAddress: resolveIpAddress(request),
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await prisma.session.findUnique({ where: { clientId } });
    if (!raced) throw error;
    return backfillMetaMatchIdentifiers(raced, meta);
  }
}

/**
 * Fills in Meta match identifiers a session was created without.
 *
 * The session row is created by whichever request arrives first — usually the
 * tracking beacon, which fires before the pixel snippet has finished loading
 * and written `_fbp`. Without this, the cookie would be visible on every later
 * request in the session and stored from none of them, and the lead's CAPI
 * event would go out with no browser id.
 *
 * Only ever writes fields that are currently null, so a later request can't
 * overwrite the first-touch `_fbc` with a fresher one, and returns the row
 * untouched when there is nothing new — this runs on every session lookup.
 */
async function backfillMetaMatchIdentifiers(
  session: Session,
  meta: MetaMatchIdentifiers,
): Promise<Session> {
  const patch: MetaMatchIdentifiers = {};
  if (!session.userAgent && meta.userAgent) patch.userAgent = meta.userAgent;
  if (!session.fbp && meta.fbp) patch.fbp = meta.fbp;
  if (!session.fbc && meta.fbc) patch.fbc = meta.fbc;

  if (Object.keys(patch).length === 0) return session;

  try {
    return await prisma.session.update({ where: { id: session.id }, data: patch });
  } catch {
    // Best-effort enrichment: a failed backfill costs match quality on one
    // event, and must never fail the tracking or lead request carrying it.
    return { ...session, ...patch };
  }
}
