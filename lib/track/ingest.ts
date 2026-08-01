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
  deviceType?: string;
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
  viewportWidth?: number;
  viewportHeight?: number;
};

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

  return prisma.visitor.upsert({
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
}

export async function findOrCreateSession(
  request: Request,
  clientId: string,
  visitorId: string,
  init: ClientSessionInit = {},
) {
  const existing = await prisma.session.findUnique({ where: { clientId } });
  if (existing) return existing;

  return prisma.session.create({
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
      viewportWidth: init.viewportWidth,
      viewportHeight: init.viewportHeight,
      ipAddress: resolveIpAddress(request),
    },
  });
}
