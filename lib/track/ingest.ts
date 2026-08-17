import "server-only";

import { geolocation, ipAddress } from "@vercel/functions";

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

// Meta/Facebook-owned IPv4 ranges confirmed (via traffic audit) to be behind
// their in-app-browser link-preview/page-prefetch infrastructure, which
// reports a synthetic square viewport (e.g. 2000x2000) and generates
// pageview/CTA/form-start events without a human present. Not exhaustive —
// Meta's ranges shift over time; extend as new prefetch traffic is spotted.
const META_CRAWLER_CIDRS = ["173.252.0.0/16", "31.13.0.0/16", "66.220.144.0/20"];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    result = (result << 8) | n;
  }
  return result >>> 0;
}

function isIpInCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(range);
  if (ipInt === null || rangeInt === null) return false;
  const bits = Number(bitsStr);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

/**
 * True for a request that looks like Meta's own crawler/prefetch
 * infrastructure rather than a person: the IP is in one of their published
 * ranges, or the reported screen is an exact square — no real device does
 * that, but headless renderers with no physical screen commonly default to
 * one (e.g. the 2000x2000 pattern this heuristic was built to catch).
 */
function looksLikeCrawler(ip: string, screenWidth?: number, screenHeight?: number): boolean {
  if (META_CRAWLER_CIDRS.some((cidr) => isIpInCidr(ip, cidr))) return true;
  return (
    typeof screenWidth === "number" &&
    typeof screenHeight === "number" &&
    screenWidth === screenHeight &&
    screenWidth >= 500
  );
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
  // Read straight off the request rather than trusting the client-reported
  // navigator.userAgent, so a raw sample survives even if parseBrowser can't
  // classify it (e.g. an in-app browser it doesn't recognize yet).
  const rawUserAgent = request.headers.get("user-agent")?.slice(0, 500) ?? undefined;
  const botSignal = looksLikeCrawler(resolveIpAddress(request), device.screenWidth, device.screenHeight);

  try {
    return await prisma.visitor.upsert({
      where: { fingerprint },
      create: {
        fingerprint,
        isReturning: false,
        isBot: botSignal,
        country: geo.country,
        region: geo.countryRegion,
        city: geo.city,
        rawUserAgent,
        ...device,
      },
      update: {
        // isReturning is NOT set here. A single visit calls upsertVisitor
        // repeatedly (every queue flush, visibilitychange, pagehide, plus a
        // lead submit) — flipping it here based on "does a Visitor row
        // already exist" marked people as returning on their first-ever
        // visit as soon as a second beacon fired. It's set exactly once,
        // in findOrCreateSession below, only when a genuinely new session
        // starts for a visitor who already has a prior one.
        //
        // isBot only ever flips false -> true (never set false here) so one
        // crawler-shaped request is enough to mark the visitor permanently.
        isBot: botSignal ? true : undefined,
        country: geo.country ?? undefined,
        region: geo.countryRegion ?? undefined,
        city: geo.city ?? undefined,
        rawUserAgent: rawUserAgent ?? undefined,
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
  const existing = await prisma.session.findUnique({ where: { clientId } });
  if (existing) return existing;

  // A genuinely new session for a visitor who already has an earlier one is
  // what "returning" should mean — checked once, here, rather than on every
  // upsertVisitor call within a single visit (see upsertVisitor above).
  const hasPriorSession = (await prisma.session.count({ where: { visitorId } })) > 0;

  try {
    const session = await prisma.session.create({
      data: {
        clientId,
        visitorId,
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

    if (hasPriorSession) {
      // isReturning only ever flips false -> true; a visitor who has
      // returned once stays "returning" rather than reverting on some later
      // read. Best-effort: losing this update must never fail session
      // creation itself.
      await prisma.visitor.update({ where: { id: visitorId }, data: { isReturning: true } }).catch(() => {});
    }

    return session;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await prisma.session.findUnique({ where: { clientId } });
    if (!raced) throw error;
    return raced;
  }
}
