import "server-only";

import { prisma } from "@/lib/db";
import {
  decodeTrackingValue,
  formatClickIds,
  formatRawParams,
  resolveTrafficSource,
  type RawParamsSummary,
} from "@/lib/admin/attribution";

export async function getNavCounts() {
  const [leads, sessions] = await Promise.all([
    prisma.lead.count({ where: { NOT: { visitor: { isBot: true } } } }),
    prisma.session.count({ where: { visitor: { isBot: false } } }),
  ]);
  return { leads, sessions };
}

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function computeOverviewStats(gte: Date, lt: Date) {
  const [visitors, sessions, leads, scrollers, ctaClicks, sessionsAgg, bounces, sessionVisitors] =
    await Promise.all([
      prisma.visitor.count({ where: { firstSeenAt: { gte, lt }, isBot: false } }),
      prisma.session.count({ where: { startedAt: { gte, lt }, visitor: { isBot: false } } }),
      prisma.lead.count({ where: { createdAt: { gte, lt }, NOT: { visitor: { isBot: true } } } }),
      prisma.scrollEvent.findMany({
        where: { createdAt: { gte, lt }, depth: { gte: 50 }, session: { visitor: { isBot: false } } },
        distinct: ["sessionId"],
        select: { sessionId: true },
      }),
      prisma.ctaEvent.count({
        where: { createdAt: { gte, lt }, action: "clicked", session: { visitor: { isBot: false } } },
      }),
      prisma.session.aggregate({
        where: { startedAt: { gte, lt }, totalDuration: { not: null }, visitor: { isBot: false } },
        _avg: { totalDuration: true },
      }),
      prisma.session.count({ where: { startedAt: { gte, lt }, isBounce: true, visitor: { isBot: false } } }),
      prisma.session.findMany({
        where: { startedAt: { gte, lt }, visitor: { isBot: false } },
        select: { visitor: { select: { isReturning: true } } },
        distinct: ["visitorId"],
      }),
    ]);

  const conversionRate = sessions > 0 ? (leads / sessions) * 100 : 0;
  const bounceRate = sessions > 0 ? (bounces / sessions) * 100 : 0;
  const returningVisitors = sessionVisitors.filter((s) => s.visitor.isReturning).length;
  const newVisitors = sessionVisitors.length - returningVisitors;

  return {
    visitors,
    sessions,
    leads,
    conversionRate,
    scrollersCount: scrollers.length,
    ctaClicks,
    avgSessionDuration: sessionsAgg._avg.totalDuration ?? 0,
    bounceRate,
    returningVisitors,
    newVisitors,
  };
}

type OverviewMetrics = Awaited<ReturnType<typeof computeOverviewStats>>;

/**
 * `null` means "no prior-period data to compare against" (prev = 0), which
 * is not the same as 0% change — callers should render that as "new"/"—"
 * rather than a real delta.
 */
function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? null : 100;
  return ((curr - prev) / prev) * 100;
}

export async function getOverviewStats(days = 30) {
  const now = new Date();
  const since = daysAgo(days);
  const prevSince = new Date(since.getTime() - days * 24 * 60 * 60 * 1000);

  const [current, previous] = await Promise.all([
    computeOverviewStats(since, now),
    computeOverviewStats(prevSince, since),
  ]);

  const deltas = Object.fromEntries(
    (Object.keys(current) as (keyof OverviewMetrics)[]).map((key) => [key, pctChange(current[key], previous[key])]),
  ) as Record<keyof OverviewMetrics, number | null>;

  return { current, previous, deltas };
}

export async function getLiveVisitorCount() {
  const since = new Date(Date.now() - 5 * 60 * 1000);
  return prisma.visitor.count({ where: { lastSeenAt: { gte: since }, isBot: false } });
}

export async function getDeviceBreakdown(days = 30) {
  const since = daysAgo(days);
  const sessions = await prisma.session.findMany({
    where: { startedAt: { gte: since }, visitor: { isBot: false } },
    select: { visitor: { select: { deviceType: true } } },
  });

  const counts = new Map<string, number>();
  for (const s of sessions) {
    const key = s.visitor.deviceType || "Unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const total = sessions.length;
  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count, pct: total > 0 ? (count / total) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);
}

export async function getBrowserBreakdown(days = 30) {
  const since = daysAgo(days);
  const sessions = await prisma.session.findMany({
    where: { startedAt: { gte: since }, visitor: { isBot: false } },
    select: { visitor: { select: { browser: true } } },
  });

  const counts = new Map<string, number>();
  for (const s of sessions) {
    const key = s.visitor.browser || "Unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([browser, count]) => ({ browser, count }))
    .sort((a, b) => b.count - a.count);
}

const CONNECTION_LABELS: Record<string, string> = {
  "4g": "4G",
  "3g": "3G",
  "2g": "2G",
  "slow-2g": "Slow 2G",
};

function viewportWidthBucket(w: number): string {
  if (w < 480) return "<480";
  if (w < 768) return "480-767";
  if (w < 1024) return "768-1023";
  if (w < 1440) return "1024-1439";
  return "1440+";
}

function viewportHeightBucket(h: number): string {
  if (h < 700) return "<700";
  if (h < 900) return "700-899";
  return "900+";
}

type SegmentAccumulator = {
  sessions: number;
  bounces: number;
  durationSum: number;
  durationCount: number;
  leads: number;
};

function emptySegment(): SegmentAccumulator {
  return { sessions: 0, bounces: 0, durationSum: 0, durationCount: 0, leads: 0 };
}

function accumulateSegment(
  map: Map<string, SegmentAccumulator>,
  key: string,
  isBounce: boolean,
  duration: number | null,
  leads: number,
) {
  const seg = map.get(key) ?? emptySegment();
  seg.sessions += 1;
  if (isBounce) seg.bounces += 1;
  if (duration != null) {
    seg.durationSum += duration;
    seg.durationCount += 1;
  }
  seg.leads += leads;
  map.set(key, seg);
}

function finalizeSegments(map: Map<string, SegmentAccumulator>, totalSessions: number) {
  return Array.from(map.entries())
    .map(([label, seg]) => ({
      label,
      sessions: seg.sessions,
      share: totalSessions > 0 ? (seg.sessions / totalSessions) * 100 : 0,
      avgDuration: seg.durationCount > 0 ? seg.durationSum / seg.durationCount : 0,
      bounceRate: seg.sessions > 0 ? (seg.bounces / seg.sessions) * 100 : 0,
      leads: seg.leads,
      conversionRate: seg.sessions > 0 ? (seg.leads / seg.sessions) * 100 : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);
}

/**
 * Everything the Tech Stack admin page needs, computed from a single pass
 * over the period's sessions so the "42 sessions" total is consistent across
 * every breakdown (devices, browsers, screen sizes, ...) instead of drifting
 * between separately-windowed queries.
 */
export async function getTechStackData(days = 30) {
  const since = daysAgo(days);

  const [sessions, leads] = await Promise.all([
    prisma.session.findMany({
      where: { startedAt: { gte: since }, visitor: { isBot: false } },
      select: {
        id: true,
        isBounce: true,
        totalDuration: true,
        viewportWidth: true,
        viewportHeight: true,
        visitor: {
          select: {
            deviceType: true,
            browser: true,
            browserVersion: true,
            os: true,
            osVersion: true,
            screenWidth: true,
            screenHeight: true,
            language: true,
            network: true,
            downlink: true,
          },
        },
      },
    }),
    prisma.lead.findMany({
      where: { createdAt: { gte: since }, sessionId: { not: null } },
      select: { sessionId: true },
    }),
  ]);

  const leadCounts = new Map<string, number>();
  for (const lead of leads) {
    if (!lead.sessionId) continue;
    leadCounts.set(lead.sessionId, (leadCounts.get(lead.sessionId) ?? 0) + 1);
  }

  const total = sessions.length;

  const deviceCounts = new Map<string, number>();
  const browserCounts = new Map<string, number>();
  const osCounts = new Map<string, number>();
  const resolutionCounts = new Map<string, number>();
  const viewportCounts = new Map<string, number>();
  const languageCounts = new Map<string, number>();
  const connectionCounts = new Map<string, number>();
  const browserSegments = new Map<string, SegmentAccumulator>();
  const osSegments = new Map<string, SegmentAccumulator>();
  let downlinkSum = 0;
  let downlinkCount = 0;

  const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);

  for (const s of sessions) {
    const v = s.visitor;
    const leadsForSession = leadCounts.get(s.id) ?? 0;

    bump(deviceCounts, v.deviceType || "Unknown");
    bump(browserCounts, v.browser || "Unknown");
    bump(osCounts, v.os || "Unknown");

    if (v.screenWidth && v.screenHeight) {
      bump(resolutionCounts, `${v.screenWidth}×${v.screenHeight}`);
    }
    if (s.viewportWidth && s.viewportHeight) {
      bump(viewportCounts, `${viewportWidthBucket(s.viewportWidth)} × ${viewportHeightBucket(s.viewportHeight)}`);
    }

    bump(languageCounts, v.language || "Unknown");

    const connectionKey = v.network ? (CONNECTION_LABELS[v.network] ?? v.network) : "Unknown";
    bump(connectionCounts, connectionKey);
    if (v.downlink != null) {
      downlinkSum += v.downlink;
      downlinkCount += 1;
    }

    const browserLabel = v.browserVersion
      ? `${v.browser || "Unknown"} ${v.browserVersion.split(".")[0]}`
      : v.browser || "Unknown";
    const osLabel = v.osVersion ? `${v.os || "Unknown"} ${v.osVersion}` : v.os || "Unknown";

    accumulateSegment(browserSegments, browserLabel, s.isBounce, s.totalDuration, leadsForSession);
    accumulateSegment(osSegments, osLabel, s.isBounce, s.totalDuration, leadsForSession);
  }

  const toList = (map: Map<string, number>) =>
    Array.from(map.entries())
      .map(([label, count]) => ({ label, count, pct: total > 0 ? (count / total) * 100 : 0 }))
      .sort((a, b) => b.count - a.count);

  return {
    totalSessions: total,
    devices: toList(deviceCounts),
    browsers: toList(browserCounts),
    operatingSystems: toList(osCounts),
    screenResolutions: toList(resolutionCounts).slice(0, 12),
    viewportSizes: toList(viewportCounts).slice(0, 10),
    languages: toList(languageCounts).slice(0, 8),
    connection: {
      quality: toList(connectionCounts),
      avgDownlink: downlinkCount > 0 ? downlinkSum / downlinkCount : null,
    },
    browserPerformance: finalizeSegments(browserSegments, total),
    osPerformance: finalizeSegments(osSegments, total),
  };
}

export async function getTopPages(days = 30, limit = 10) {
  const since = daysAgo(days);

  const [viewRows, entrySessions, leads] = await Promise.all([
    prisma.pageView.groupBy({
      by: ["path"],
      where: { enteredAt: { gte: since }, session: { visitor: { isBot: false } } },
      _count: { _all: true },
      _avg: { timeOnPage: true },
    }),
    prisma.session.findMany({
      where: { startedAt: { gte: since }, entryPath: { not: null }, visitor: { isBot: false } },
      select: { entryPath: true, isBounce: true },
    }),
    prisma.lead.findMany({
      where: { createdAt: { gte: since }, sessionId: { not: null }, NOT: { visitor: { isBot: true } } },
      select: { session: { select: { entryPath: true } } },
    }),
  ]);

  const sessionTotals = new Map<string, number>();
  const bounceTotals = new Map<string, number>();
  for (const s of entrySessions) {
    const path = s.entryPath as string;
    sessionTotals.set(path, (sessionTotals.get(path) ?? 0) + 1);
    if (s.isBounce) bounceTotals.set(path, (bounceTotals.get(path) ?? 0) + 1);
  }

  const leadTotals = new Map<string, number>();
  for (const l of leads) {
    const path = l.session?.entryPath;
    if (!path) continue;
    leadTotals.set(path, (leadTotals.get(path) ?? 0) + 1);
  }

  return viewRows
    .map((row) => {
      const entrySessionCount = sessionTotals.get(row.path) ?? 0;
      const bounceCount = bounceTotals.get(row.path) ?? 0;
      return {
        path: row.path,
        views: row._count._all,
        avgTimeOnPage: row._avg.timeOnPage ?? 0,
        bounceRate: entrySessionCount > 0 ? (bounceCount / entrySessionCount) * 100 : 0,
        conversions: leadTotals.get(row.path) ?? 0,
      };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}

export async function getVisitorsByCountry(days = 30) {
  const since = daysAgo(days);

  const [visitors, leads] = await Promise.all([
    prisma.visitor.groupBy({
      by: ["country"],
      where: { firstSeenAt: { gte: since }, isBot: false },
      _count: { _all: true },
    }),
    prisma.lead.findMany({
      where: { createdAt: { gte: since }, NOT: { visitor: { isBot: true } } },
      select: { visitor: { select: { country: true } } },
    }),
  ]);

  const leadCounts = new Map<string, number>();
  for (const l of leads) {
    const country = l.visitor?.country ?? "Unknown";
    leadCounts.set(country, (leadCounts.get(country) ?? 0) + 1);
  }

  return visitors
    .map((v) => ({
      country: v.country ?? "Unknown",
      visitors: v._count._all,
      leads: leadCounts.get(v.country ?? "Unknown") ?? 0,
    }))
    .sort((a, b) => b.visitors - a.visitors);
}

export async function getDailyTimeSeries(days = 30) {
  const since = daysAgo(days - 1);

  const [visitors, sessions, leads] = await Promise.all([
    prisma.visitor.findMany({
      where: { firstSeenAt: { gte: since }, isBot: false },
      select: { firstSeenAt: true },
    }),
    prisma.session.findMany({
      where: { startedAt: { gte: since }, visitor: { isBot: false } },
      select: { startedAt: true },
    }),
    prisma.lead.findMany({
      where: { createdAt: { gte: since }, NOT: { visitor: { isBot: true } } },
      select: { createdAt: true },
    }),
  ]);

  const buckets = new Map<string, { date: string; visitors: number; sessions: number; leads: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { date: key, visitors: 0, sessions: 0, leads: 0 });
  }

  const bump = (date: Date, field: "visitors" | "sessions" | "leads") => {
    const key = date.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (bucket) bucket[field] += 1;
  };

  visitors.forEach((v) => bump(v.firstSeenAt, "visitors"));
  sessions.forEach((s) => bump(s.startedAt, "sessions"));
  leads.forEach((l) => bump(l.createdAt, "leads"));

  return Array.from(buckets.values());
}

export async function getTrafficSources(days = 30) {
  const since = daysAgo(days);

  const sessions = await prisma.session.groupBy({
    by: ["utmSource", "utmMedium", "utmCampaign"],
    where: { startedAt: { gte: since }, visitor: { isBot: false } },
    _count: { _all: true },
  });

  const leads = await prisma.lead.findMany({
    where: { createdAt: { gte: since }, sessionId: { not: null }, NOT: { visitor: { isBot: true } } },
    select: {
      session: { select: { utmSource: true, utmMedium: true, utmCampaign: true } },
    },
  });

  const leadCounts = new Map<string, number>();
  for (const lead of leads) {
    const key = `${lead.session?.utmSource ?? ""}|${lead.session?.utmMedium ?? ""}|${lead.session?.utmCampaign ?? ""}`;
    leadCounts.set(key, (leadCounts.get(key) ?? 0) + 1);
  }

  return sessions
    .map((row) => {
      const key = `${row.utmSource ?? ""}|${row.utmMedium ?? ""}|${row.utmCampaign ?? ""}`;
      const leads = leadCounts.get(key) ?? 0;
      return {
        source: row.utmSource ?? "(direct)",
        medium: row.utmMedium ?? "—",
        campaign: row.utmCampaign ?? "—",
        sessions: row._count._all,
        leads,
        conversionRate: row._count._all > 0 ? (leads / row._count._all) * 100 : 0,
      };
    })
    .sort((a, b) => b.sessions - a.sessions);
}

export async function getRecentLeads(limit = 8) {
  return prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export type LeadFilters = {
  status?: string;
  source?: string;
  campaign?: string;
  country?: string;
  device?: string;
  q?: string;
  from?: Date;
  to?: Date;
  /** 1-based. Ignored (no pagination) when `pageSize` is omitted — used for exports. */
  page?: number;
  pageSize?: number;
};

export type LeadRow = {
  id: string;
  visitorId: string | null;
  sessionId: string | null;
  /** Friendly, human-facing id — "RR-0001" — derived from createdAt order, not stored. */
  displayId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  budget: string | null;
  message: string | null;
  city: string | null;
  country: string | null;
  source: string | null;
  /** Meta campaign name, resolved via session.metaCampaignId; falls back to the raw UTM campaign. */
  campaign: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  status: string;
  metaCapiSentAt: Date | null;
  metaCapiError: string | null;
  metaAdId: string | null;
  placement: string | null;
  fbclid: string | null;
  createdAt: Date;
  rawParamsPreview: string | null;
};

export async function getLeads(filters: LeadFilters = {}): Promise<{ rows: LeadRow[]; total: number }> {
  const { status, source, campaign, country, device, q, from, to, page, pageSize } = filters;

  const [matching, allIds, campaigns] = await Promise.all([
    prisma.lead.findMany({
      where: {
        ...(status && status !== "all" ? { status } : {}),
        ...(source && source !== "all" ? { source } : {}),
        ...(campaign && campaign !== "all" ? { session: { utmCampaign: campaign } } : {}),
        ...(country && country !== "all" ? { visitor: { country } } : {}),
        ...(device && device !== "all" ? { visitor: { deviceType: device } } : {}),
        ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        // `visitor`/`metaAdId`/`placement`/`fbclid` are also here for the Meta CAPI send modal.
        visitor: { select: { city: true, country: true, deviceType: true, browser: true, os: true } },
        session: {
          select: {
            utmSource: true,
            utmMedium: true,
            utmCampaign: true,
            utmContent: true,
            utmTerm: true,
            placement: true,
            metaAdId: true,
            metaCampaignId: true,
            gclid: true,
            fbclid: true,
            msclkid: true,
            ipAddress: true,
            rawParams: true,
          },
        },
      },
    }),
    prisma.lead.findMany({ select: { id: true }, orderBy: { createdAt: "asc" } }),
    prisma.campaign.findMany({ select: { metaId: true, name: true } }),
  ]);

  const seqById = new Map(allIds.map((lead, index) => [lead.id, index + 1]));
  const campaignNameByMetaId = new Map(campaigns.map((c) => [c.metaId, c.name]));

  let rows: LeadRow[] = matching.map((lead) => ({
    id: lead.id,
    visitorId: lead.visitorId,
    sessionId: lead.sessionId,
    displayId: `RR-${String(seqById.get(lead.id) ?? 0).padStart(4, "0")}`,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    budget: lead.budget,
    message: lead.message,
    city: lead.visitor?.city ?? null,
    country: lead.visitor?.country ?? null,
    source: lead.source,
    campaign:
      (lead.session?.metaCampaignId && campaignNameByMetaId.get(lead.session.metaCampaignId)) ||
      lead.session?.utmCampaign ||
      null,
    utmSource: lead.session?.utmSource ?? null,
    utmMedium: lead.session?.utmMedium ?? null,
    utmCampaign: lead.session?.utmCampaign ?? null,
    device: lead.visitor?.deviceType ?? null,
    browser: lead.visitor?.browser ?? null,
    os: lead.visitor?.os ?? null,
    ipAddress: lead.session?.ipAddress ?? null,
    status: lead.status,
    metaCapiSentAt: lead.metaCapiSentAt,
    metaCapiError: lead.metaCapiError,
    metaAdId: lead.session?.metaAdId ?? null,
    placement: lead.session?.placement ?? null,
    fbclid: lead.session?.fbclid ?? null,
    createdAt: lead.createdAt,
    rawParamsPreview: formatRawParams(lead.session?.rawParams)?.full ?? null,
  }));

  if (q && q.trim()) {
    const needle = q.trim().toLowerCase();
    rows = rows.filter((row) =>
      [row.displayId, row.name, row.phone, row.email].some((value) => value?.toLowerCase().includes(needle)),
    );
  }

  const total = rows.length;

  if (pageSize) {
    const start = (Math.max(1, page ?? 1) - 1) * pageSize;
    rows = rows.slice(start, start + pageSize);
  }

  return { rows, total };
}

export type LeadsDateRange = { from: Date; to: Date } | null;

/** `range` is one of "today" | "7" | "30" | "90" | "all". Unknown values fall back to 30 days. */
export function resolveLeadsDateRange(range: string | null | undefined): LeadsDateRange {
  if (range === "all") return null;

  const to = new Date();
  const from = new Date(to);

  if (range === "today") {
    from.setHours(0, 0, 0, 0);
  } else {
    const days = range === "7" ? 7 : range === "90" ? 90 : 30;
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);
  }

  return { from, to };
}

export async function getLeadStats(range: LeadsDateRange) {
  const createdWhere = range ? { createdAt: { gte: range.from, lte: range.to } } : {};
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [total, today, qualified, won, lost, sessions] = await Promise.all([
    prisma.lead.count({ where: createdWhere }),
    prisma.lead.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.lead.count({ where: { ...createdWhere, status: "qualified" } }),
    prisma.lead.count({ where: { ...createdWhere, status: "won" } }),
    prisma.lead.count({ where: { ...createdWhere, status: "lost" } }),
    prisma.session.count({
      where: {
        ...(range ? { startedAt: { gte: range.from, lte: range.to } } : {}),
        visitor: { isBot: false },
      },
    }),
  ]);

  return {
    total,
    today,
    qualified,
    won,
    lost,
    conversionRate: sessions > 0 ? (total / sessions) * 100 : 0,
  };
}

export async function getLeadFilterOptions() {
  // Filter values must match what `getLeads`' `campaign` filter actually queries against
  // (session.utmCampaign) — Meta campaign names are shown in the table but aren't filterable
  // here since a lead's session doesn't always carry a resolvable metaCampaignId.
  const leads = await prisma.lead.findMany({
    select: {
      source: true,
      visitor: { select: { country: true, deviceType: true } },
      session: { select: { utmCampaign: true } },
    },
  });

  const sources = new Set<string>();
  const countries = new Set<string>();
  const devices = new Set<string>();
  const campaigns = new Set<string>();

  for (const lead of leads) {
    if (lead.source) sources.add(lead.source);
    if (lead.visitor?.country) countries.add(lead.visitor.country);
    if (lead.visitor?.deviceType) devices.add(lead.visitor.deviceType);
    if (lead.session?.utmCampaign) campaigns.add(lead.session.utmCampaign);
  }

  return {
    sources: Array.from(sources).sort(),
    countries: Array.from(countries).sort(),
    devices: Array.from(devices).sort(),
    campaigns: Array.from(campaigns).sort(),
  };
}

export type LeadDetail = {
  totalVisits: number;
  landingPage: string | null;
  referrer: string | null;
  journey: {
    durationSeconds: number | null;
    pagesViewed: number;
    maxScrollPct: number;
    clicks: number;
  } | null;
  pageViews: { path: string; timeOnPageSeconds: number | null; pctOfDuration: number }[];
  timeline: { at: Date; label: string }[];
  hasReplay: boolean;
};

/**
 * Everything the Lead detail panel needs beyond what's already in `LeadRow`
 * — the visitor's session history and on-page behaviour — fetched on demand
 * when a row is opened rather than joined into every `getLeads` row.
 */
export async function getLeadDetail(leadId: string): Promise<LeadDetail | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { visitorId: true, sessionId: true },
  });
  if (!lead) return null;

  const sessionId = lead.sessionId;

  const [totalVisits, session, pageViews, timeline, clicks, replayCount, scrollAgg] = await Promise.all([
    lead.visitorId ? prisma.session.count({ where: { visitorId: lead.visitorId } }) : Promise.resolve(0),
    sessionId
      ? prisma.session.findUnique({
          where: { id: sessionId },
          select: { entryPath: true, referrer: true, totalDuration: true, pagesViewed: true },
        })
      : Promise.resolve(null),
    sessionId
      ? prisma.pageView.findMany({ where: { sessionId }, orderBy: { enteredAt: "asc" } })
      : Promise.resolve([]),
    sessionId ? getSessionTimeline(sessionId) : Promise.resolve([]),
    sessionId ? prisma.heatmapEvent.count({ where: { sessionId, type: "click" } }) : Promise.resolve(0),
    sessionId ? prisma.sessionReplay.count({ where: { sessionId } }) : Promise.resolve(0),
    sessionId
      ? prisma.scrollEvent.aggregate({ where: { sessionId }, _max: { depth: true } })
      : Promise.resolve(null),
  ]);

  const totalDuration = session?.totalDuration ?? 0;

  return {
    totalVisits,
    landingPage: session?.entryPath ?? null,
    referrer: session?.referrer ?? null,
    journey: session
      ? {
          durationSeconds: session.totalDuration,
          pagesViewed: session.pagesViewed,
          maxScrollPct: scrollAgg?._max.depth ?? 0,
          clicks,
        }
      : null,
    pageViews: pageViews.map((pv) => {
      // `timeOnPage` is captured client-side in milliseconds; `totalDuration` is
      // seconds — convert before comparing so the percentage is meaningful.
      const timeOnPageSeconds = pv.timeOnPage != null ? pv.timeOnPage / 1000 : null;
      return {
        path: pv.path,
        timeOnPageSeconds,
        pctOfDuration: totalDuration > 0 && timeOnPageSeconds ? (timeOnPageSeconds / totalDuration) * 100 : 0,
      };
    }),
    timeline,
    hasReplay: replayCount > 0,
  };
}

export type SessionFilters = {
  days?: number;
  visitorType?: "new" | "returning" | "all";
  country?: string;
  city?: string;
  device?: string;
  browser?: string;
  os?: string;
  source?: string;
  q?: string;
};

export type SessionRow = {
  id: string;
  clientId: string;
  visitorId: string;
  fingerprint: string;
  isReturning: boolean;
  status: "active" | "bounced" | "completed";
  startedAt: Date;
  endedAt: Date | null;
  totalDuration: number | null;
  isBounce: boolean;
  pagesViewed: number;
  entryPath: string | null;
  exitPath: string | null;
  currentPath: string | null;
  referrer: string | null;
  trafficSource: string;
  utmCampaign: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  placement: string | null;
  metaCampaignId: string | null;
  metaAdsetId: string | null;
  metaAdId: string | null;
  clickIds: string | null;
  rawParams: RawParamsSummary | null;
  ipAddress: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  timezone: string | null;
  language: string | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  deviceType: string | null;
  screenWidth: number | null;
  screenHeight: number | null;
  network: string | null;
  avgScrollPct: number;
  maxScrollPct: number;
  mouseClicks: number;
  mouseMovements: number;
  formStarted: boolean;
  formSubmitted: boolean;
  ctaClicked: boolean;
  hasReplay: boolean;
};

const LIVE_WINDOW_MS = 5 * 60 * 1000;

/**
 * The Sessions table needs every filter dropdown to offer only values that
 * actually occur in the data, so options and rows stay consistent with each
 * other (picking "Firefox" never yields zero results because of a stale list).
 */
export async function getSessionFilterOptions() {
  const [visitorFacets, sessions] = await Promise.all([
    prisma.visitor.findMany({
      select: { country: true, city: true, deviceType: true, browser: true, os: true },
    }),
    prisma.session.findMany({ select: { utmSource: true, referrer: true } }),
  ]);

  const countries = new Set<string>();
  const cities = new Set<string>();
  const devices = new Set<string>();
  const browsers = new Set<string>();
  const systems = new Set<string>();
  for (const v of visitorFacets) {
    if (v.country) countries.add(v.country);
    if (v.city) cities.add(v.city);
    if (v.deviceType) devices.add(v.deviceType);
    if (v.browser) browsers.add(v.browser);
    if (v.os) systems.add(v.os);
  }

  const sources = new Set<string>();
  for (const s of sessions) sources.add(resolveTrafficSource(s));

  return {
    countries: Array.from(countries).sort(),
    cities: Array.from(cities).sort(),
    devices: Array.from(devices).sort(),
    browsers: Array.from(browsers).sort(),
    systems: Array.from(systems).sort(),
    sources: Array.from(sources).sort(),
  };
}

export async function getSessionStats(days = 7) {
  const since = daysAgo(days);
  const liveSince = new Date(Date.now() - LIVE_WINDOW_MS);

  const [total, live, returningSessions, durationAgg, bounces] = await Promise.all([
    prisma.session.count({ where: { startedAt: { gte: since }, visitor: { isBot: false } } }),
    prisma.visitor.count({ where: { lastSeenAt: { gte: liveSince }, isBot: false } }),
    prisma.session.findMany({
      where: { startedAt: { gte: since }, visitor: { isReturning: true, isBot: false } },
      distinct: ["visitorId"],
      select: { visitorId: true },
    }),
    prisma.session.aggregate({
      where: { startedAt: { gte: since }, totalDuration: { not: null }, visitor: { isBot: false } },
      _avg: { totalDuration: true },
    }),
    prisma.session.count({ where: { startedAt: { gte: since }, isBounce: true, visitor: { isBot: false } } }),
  ]);

  return {
    total,
    live,
    returningVisitors: returningSessions.length,
    avgDuration: Math.round(durationAgg._avg.totalDuration ?? 0),
    bounceRate: total > 0 ? (bounces / total) * 100 : 0,
  };
}

/**
 * The full session listing behind the admin Sessions table. Every derived
 * stat (scroll depth, mouse activity, form/CTA engagement) is computed from
 * the actual per-session event tables rather than stored redundantly on
 * Session, so it's fetched here as a handful of batched aggregate queries
 * over the filtered session ids instead of one query per row.
 */
export async function getSessions(filters: SessionFilters = {}, limit = 300): Promise<SessionRow[]> {
  const { days, visitorType, country, city, device, browser, os, source, q } = filters;
  const since = days ? daysAgo(days) : undefined;

  const visitorWhere = {
    ...(visitorType === "new" ? { isReturning: false } : {}),
    ...(visitorType === "returning" ? { isReturning: true } : {}),
    ...(country && country !== "all" ? { country } : {}),
    ...(city && city !== "all" ? { city } : {}),
    ...(device && device !== "all" ? { deviceType: device } : {}),
    ...(browser && browser !== "all" ? { browser } : {}),
    ...(os && os !== "all" ? { os } : {}),
  };
  const hasVisitorFilter = Object.keys(visitorWhere).length > 0;

  const sessions = await prisma.session.findMany({
    where: {
      ...(since ? { startedAt: { gte: since } } : {}),
      ...(hasVisitorFilter ? { visitor: visitorWhere } : {}),
    },
    orderBy: { startedAt: "desc" },
    take: limit,
    include: {
      visitor: true,
      _count: { select: { replays: true } },
      pageViews: { orderBy: { enteredAt: "desc" }, take: 1 },
    },
  });

  let filtered = source && source !== "all" ? sessions.filter((s) => resolveTrafficSource(s) === source) : sessions;

  if (q && q.trim()) {
    const needle = q.trim().toLowerCase();
    filtered = filtered.filter((s) =>
      [s.id, s.ipAddress, s.visitor.fingerprint, s.visitor.browser, s.visitor.city, s.visitor.country]
        .filter(Boolean)
        .some((value) => (value as string).toLowerCase().includes(needle)),
    );
  }

  if (filtered.length === 0) return [];

  const ids = filtered.map((s) => s.id);
  const liveSince = new Date(Date.now() - LIVE_WINDOW_MS);

  const [scrollAgg, heatmapAgg, formRows, ctaRows] = await Promise.all([
    prisma.scrollEvent.groupBy({
      by: ["sessionId"],
      where: { sessionId: { in: ids } },
      _avg: { depth: true },
      _max: { depth: true },
    }),
    prisma.heatmapEvent.groupBy({
      by: ["sessionId", "type"],
      where: { sessionId: { in: ids }, type: { in: ["click", "hover"] } },
      _count: { _all: true },
    }),
    prisma.formEvent.findMany({
      where: { sessionId: { in: ids }, action: { in: ["started", "submitted"] } },
      select: { sessionId: true, action: true },
      distinct: ["sessionId", "action"],
    }),
    prisma.ctaEvent.findMany({
      where: { sessionId: { in: ids }, action: "clicked" },
      select: { sessionId: true },
      distinct: ["sessionId"],
    }),
  ]);

  const scrollBySession = new Map(scrollAgg.map((r) => [r.sessionId, r]));
  const clicksBySession = new Map<string, number>();
  const movesBySession = new Map<string, number>();
  for (const row of heatmapAgg) {
    if (row.type === "click") clicksBySession.set(row.sessionId, row._count._all);
    if (row.type === "hover") movesBySession.set(row.sessionId, row._count._all);
  }
  const startedForm = new Set(formRows.filter((r) => r.action === "started").map((r) => r.sessionId));
  const submittedForm = new Set(formRows.filter((r) => r.action === "submitted").map((r) => r.sessionId));
  const ctaClickedSet = new Set(ctaRows.map((r) => r.sessionId));

  return filtered.map((session) => {
    const scroll = scrollBySession.get(session.id);
    const status: SessionRow["status"] = session.isBounce
      ? "bounced"
      : !session.endedAt && session.visitor.lastSeenAt >= liveSince
        ? "active"
        : "completed";

    return {
      id: session.id,
      clientId: session.clientId,
      visitorId: session.visitor.id,
      fingerprint: session.visitor.fingerprint,
      isReturning: session.visitor.isReturning,
      status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      totalDuration: session.totalDuration,
      isBounce: session.isBounce,
      pagesViewed: session.pagesViewed,
      entryPath: session.entryPath,
      exitPath: session.exitPath,
      currentPath: session.pageViews[0]?.path ?? session.exitPath ?? session.entryPath,
      referrer: session.referrer,
      trafficSource: resolveTrafficSource(session),
      utmCampaign: decodeTrackingValue(session.utmCampaign),
      utmSource: decodeTrackingValue(session.utmSource),
      utmMedium: decodeTrackingValue(session.utmMedium),
      utmContent: decodeTrackingValue(session.utmContent),
      utmTerm: decodeTrackingValue(session.utmTerm),
      placement: decodeTrackingValue(session.placement),
      metaCampaignId: session.metaCampaignId,
      metaAdsetId: session.metaAdsetId,
      metaAdId: session.metaAdId,
      clickIds: formatClickIds(session),
      rawParams: formatRawParams(session.rawParams),
      ipAddress: session.ipAddress,
      country: session.visitor.country,
      city: session.visitor.city,
      region: session.visitor.region,
      timezone: session.visitor.timezone,
      language: session.visitor.language,
      browser: session.visitor.browser,
      browserVersion: session.visitor.browserVersion,
      os: session.visitor.os,
      deviceType: session.visitor.deviceType,
      screenWidth: session.visitor.screenWidth,
      screenHeight: session.visitor.screenHeight,
      network: session.visitor.network,
      avgScrollPct: Math.round(scroll?._avg.depth ?? 0),
      maxScrollPct: Math.round(scroll?._max.depth ?? 0),
      mouseClicks: clicksBySession.get(session.id) ?? 0,
      mouseMovements: movesBySession.get(session.id) ?? 0,
      formStarted: startedForm.has(session.id),
      formSubmitted: submittedForm.has(session.id),
      ctaClicked: ctaClickedSet.has(session.id),
      hasReplay: session._count.replays > 0,
    };
  });
}

/**
 * Human-readable timeline for the replay modal's event log, built from the
 * same per-session event tables as `getSessions`'s aggregates — every entry
 * is a real tracked event, not a synthesized summary.
 */
export async function getSessionTimeline(sessionId: string) {
  const [pageViews, ctaEvents, formEvents, scrollEvents, mouseEvents, errors] = await Promise.all([
    prisma.pageView.findMany({ where: { sessionId }, orderBy: { enteredAt: "asc" } }),
    prisma.ctaEvent.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } }),
    prisma.formEvent.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } }),
    prisma.scrollEvent.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } }),
    prisma.mouseEvent.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } }),
    prisma.errorEvent.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } }),
  ]);

  const entries: { at: Date; label: string }[] = [];

  for (const pv of pageViews) entries.push({ at: pv.enteredAt, label: `Opened ${pv.path}` });

  const CTA_VERB: Record<string, string> = { viewed: "Saw", hovered: "Hovered on", clicked: "Clicked" };
  for (const e of ctaEvents) entries.push({ at: e.createdAt, label: `${CTA_VERB[e.action] ?? e.action} "${e.ctaId}"` });

  const FORM_VERB: Record<string, string> = {
    viewed: "Saw form",
    started: "Started form",
    field_focus: "Focused a field in",
    field_complete: "Completed a field in",
    validation_error: "Got a validation error in",
    abandoned: "Abandoned form",
    submitted: "Submitted form",
  };
  for (const e of formEvents) {
    const verb = FORM_VERB[e.action] ?? e.action;
    entries.push({ at: e.createdAt, label: `${verb} "${e.formId}"${e.fieldName ? ` · ${e.fieldName}` : ""}` });
  }

  for (const e of scrollEvents) entries.push({ at: e.createdAt, label: `Scrolled to ${e.depth}%` });

  const MOUSE_LABEL: Record<string, string> = {
    rage_click: "Rage-clicked",
    dead_click: "Dead-clicked",
    double_click: "Double-clicked",
  };
  for (const e of mouseEvents) {
    const label = MOUSE_LABEL[e.type] ?? e.type;
    entries.push({ at: e.createdAt, label: e.targetSelector ? `${label} "${e.targetSelector}"` : label });
  }

  for (const e of errors) entries.push({ at: e.createdAt, label: `Error: ${e.message}` });

  return entries.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export async function getErrors(limit = 100) {
  return prisma.errorEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getCtaStats(days = 30) {
  const since = daysAgo(days);

  const rows = await prisma.ctaEvent.groupBy({
    by: ["ctaId", "action"],
    where: { createdAt: { gte: since }, session: { visitor: { isBot: false } } },
    _count: { _all: true },
  });

  const byId = new Map<string, { ctaId: string; viewed: number; hovered: number; clicked: number }>();
  for (const row of rows) {
    const entry = byId.get(row.ctaId) ?? { ctaId: row.ctaId, viewed: 0, hovered: 0, clicked: 0 };
    if (row.action === "viewed") entry.viewed = row._count._all;
    if (row.action === "hovered") entry.hovered = row._count._all;
    if (row.action === "clicked") entry.clicked = row._count._all;
    byId.set(row.ctaId, entry);
  }

  return Array.from(byId.values())
    .map((entry) => ({ ...entry, ctr: entry.viewed > 0 ? (entry.clicked / entry.viewed) * 100 : 0 }))
    .sort((a, b) => b.clicked - a.clicked);
}

export async function getFormStats(days = 30) {
  const since = daysAgo(days);

  const rows = await prisma.formEvent.groupBy({
    by: ["formId", "action"],
    where: { createdAt: { gte: since }, session: { visitor: { isBot: false } } },
    _count: { _all: true },
  });

  type FormStatEntry = {
    formId: string;
    viewed: number;
    started: number;
    submitted: number;
    abandoned: number;
    validation_error: number;
  };
  const TRACKED_ACTIONS = ["viewed", "started", "submitted", "abandoned", "validation_error"] as const;

  const byId = new Map<string, FormStatEntry>();
  for (const row of rows) {
    const entry: FormStatEntry =
      byId.get(row.formId) ??
      { formId: row.formId, viewed: 0, started: 0, submitted: 0, abandoned: 0, validation_error: 0 };
    if ((TRACKED_ACTIONS as readonly string[]).includes(row.action)) {
      entry[row.action as (typeof TRACKED_ACTIONS)[number]] = row._count._all;
    }
    byId.set(row.formId, entry);
  }

  return Array.from(byId.values())
    .map((entry) => ({
      ...entry,
      completionRate: entry.started > 0 ? (entry.submitted / entry.started) * 100 : 0,
    }))
    .sort((a, b) => b.submitted - a.submitted);
}

export async function getPerformanceStats(days = 30) {
  const since = daysAgo(days);

  const metrics = ["LCP", "INP", "CLS", "FCP", "TTFB"] as const;

  const results = await Promise.all(
    metrics.map(async (metric) => {
      const botFilter = { session: { visitor: { isBot: false } } } as const;
      const [avg, good, needsImprovement, poor] = await Promise.all([
        prisma.performanceMetric.aggregate({
          where: { metric, createdAt: { gte: since }, ...botFilter },
          _avg: { value: true },
          _count: { _all: true },
        }),
        prisma.performanceMetric.count({ where: { metric, rating: "good", createdAt: { gte: since }, ...botFilter } }),
        prisma.performanceMetric.count({
          where: { metric, rating: "needs-improvement", createdAt: { gte: since }, ...botFilter },
        }),
        prisma.performanceMetric.count({ where: { metric, rating: "poor", createdAt: { gte: since }, ...botFilter } }),
      ]);

      return {
        metric,
        avg: avg._avg.value ?? 0,
        sampleCount: avg._count._all,
        good,
        needsImprovement,
        poor,
      };
    }),
  );

  return results;
}

export async function getFunnelStats(days = 30, source: "all" | "meta" = "all") {
  const since = daysAgo(days);
  const sourceFilter = source === "meta" ? { fbclid: { not: null } } : {};

  const sessions = await prisma.session.findMany({
    where: { startedAt: { gte: since }, visitor: { isBot: false }, ...sourceFilter },
    select: { id: true },
  });
  const sessionIds = sessions.map((s) => s.id);
  const pageViews = sessionIds.length;

  if (pageViews === 0) {
    return {
      source,
      stages: [
        { key: "pageView", label: "Page View", count: 0 },
        { key: "scrolled25", label: "Scrolled 25%+", count: 0 },
        { key: "ctaClick", label: "CTA Click", count: 0 },
        { key: "formStart", label: "Form Start", count: 0 },
        { key: "leadSubmit", label: "Lead Submit", count: 0 },
      ],
    };
  }

  const [scrolled25, ctaClick, formStart, leadSubmit] = await Promise.all([
    prisma.scrollEvent.findMany({
      where: { sessionId: { in: sessionIds }, depth: { gte: 25 } },
      distinct: ["sessionId"],
      select: { sessionId: true },
    }),
    prisma.ctaEvent.findMany({
      where: { sessionId: { in: sessionIds }, action: "clicked" },
      distinct: ["sessionId"],
      select: { sessionId: true },
    }),
    prisma.formEvent.findMany({
      where: { sessionId: { in: sessionIds }, action: "started" },
      distinct: ["sessionId"],
      select: { sessionId: true },
    }),
    prisma.lead.findMany({
      where: { sessionId: { in: sessionIds } },
      distinct: ["sessionId"],
      select: { sessionId: true },
    }),
  ]);

  return {
    source,
    stages: [
      { key: "pageView", label: "Page View", count: pageViews },
      { key: "scrolled25", label: "Scrolled 25%+", count: scrolled25.length },
      { key: "ctaClick", label: "CTA Click", count: ctaClick.length },
      { key: "formStart", label: "Form Start", count: formStart.length },
      { key: "leadSubmit", label: "Lead Submit", count: leadSubmit.length },
    ],
  };
}

export type HeatmapDevice = "desktop" | "tablet" | "mobile";

// isBot: false is unconditional here (not just when `device` is passed) so
// every heatmap/scroll-depth query built on this helper excludes Meta's
// crawler/prefetch traffic, which does fire these events when it executes
// the page's JS.
function sessionDeviceWhere(device?: HeatmapDevice) {
  return { session: { visitor: { isBot: false, ...(device ? { deviceType: device } : {}) } } };
}

export async function getHeatmapPaths(days = 30) {
  const since = daysAgo(days);

  const [heatmapPaths, viewCounts] = await Promise.all([
    prisma.heatmapEvent.groupBy({
      by: ["path"],
      where: { createdAt: { gte: since }, session: { visitor: { isBot: false } } },
      _count: { _all: true },
      orderBy: { _count: { path: "desc" } },
    }),
    prisma.pageView.groupBy({
      by: ["path"],
      where: { enteredAt: { gte: since }, session: { visitor: { isBot: false } } },
      _count: { _all: true },
    }),
  ]);

  const viewsByPath = new Map(viewCounts.map((v) => [v.path, v._count._all]));
  return heatmapPaths.map((p) => ({ path: p.path, views: viewsByPath.get(p.path) ?? p._count._all }));
}

export async function getHeatmapSummary(path: string, type: "click" | "hover", days = 30, device?: HeatmapDevice) {
  const since = daysAgo(days);
  const where = { path, type, createdAt: { gte: since }, ...sessionDeviceWhere(device) };

  const [interactions, sessionRows] = await Promise.all([
    prisma.heatmapEvent.count({ where }),
    prisma.heatmapEvent.findMany({ where, distinct: ["sessionId"], select: { sessionId: true } }),
  ]);

  return { interactions, sessions: sessionRows.length };
}

export async function getHeatmapPoints(path: string, type: "click" | "hover", days = 30, device?: HeatmapDevice) {
  const since = daysAgo(days);
  return prisma.heatmapEvent.findMany({
    where: { path, type, createdAt: { gte: since }, ...sessionDeviceWhere(device) },
    select: { xPct: true, yPct: true, selector: true, text: true },
    orderBy: { createdAt: "desc" },
    take: 4000,
  });
}

export type InteractionHotspot = {
  selector: string;
  label: string;
  x: number;
  y: number;
  count: number;
  visitors: number;
  /** Share of visitors who interacted with this element and later became a lead. `click` only. */
  conversionPct?: number;
};

/**
 * Clusters raw click/hover points by the element selector they landed on, so the UI can show a
 * ranked "most clicked/hovered elements" list and hoverable hotspot markers at each element's
 * average position — instead of just a raw density cloud.
 */
export async function getInteractionHotspots(
  path: string,
  type: "click" | "hover",
  days = 30,
  device?: HeatmapDevice,
  limit = 10,
): Promise<InteractionHotspot[]> {
  const since = daysAgo(days);
  const rows = await prisma.heatmapEvent.findMany({
    where: { path, type, selector: { not: null }, createdAt: { gte: since }, ...sessionDeviceWhere(device) },
    select: { selector: true, text: true, sessionId: true, xPct: true, yPct: true },
    take: 5000,
  });

  type Agg = { selector: string; label: string; count: number; sessions: Set<string>; sumX: number; sumY: number };
  const byKey = new Map<string, Agg>();
  for (const row of rows) {
    const key = row.selector as string;
    const entry =
      byKey.get(key) ?? { selector: key, label: row.text || key, count: 0, sessions: new Set<string>(), sumX: 0, sumY: 0 };
    entry.count += 1;
    entry.sessions.add(row.sessionId);
    entry.sumX += row.xPct;
    entry.sumY += row.yPct;
    byKey.set(key, entry);
  }

  const top = Array.from(byKey.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  let convertedSessions = new Set<string>();
  if (type === "click") {
    const allSessionIds = Array.from(new Set(top.flatMap((e) => Array.from(e.sessions))));
    if (allSessionIds.length > 0) {
      const leads = await prisma.lead.findMany({
        where: { sessionId: { in: allSessionIds } },
        select: { sessionId: true },
      });
      convertedSessions = new Set(leads.map((l) => l.sessionId as string));
    }
  }

  return top.map((e) => {
    const visitors = e.sessions.size;
    const convertedCount = type === "click" ? Array.from(e.sessions).filter((s) => convertedSessions.has(s)).length : 0;
    return {
      selector: e.selector,
      label: e.label,
      x: e.sumX / e.count,
      y: e.sumY / e.count,
      count: e.count,
      visitors,
      ...(type === "click" ? { conversionPct: visitors > 0 ? (convertedCount / visitors) * 100 : 0 } : {}),
    };
  });
}

const SCROLL_DECILES = [10, 25, 50, 75, 90, 100];

export async function getScrollDepthProfile(path: string, days = 30, device?: HeatmapDevice) {
  const since = daysAgo(days);

  const [pageViewSessions, scrollRows] = await Promise.all([
    prisma.pageView.findMany({
      where: { path, enteredAt: { gte: since }, ...sessionDeviceWhere(device) },
      distinct: ["sessionId"],
      select: { sessionId: true },
    }),
    prisma.scrollEvent.findMany({
      where: { path, createdAt: { gte: since }, ...sessionDeviceWhere(device) },
      select: { sessionId: true, depth: true },
    }),
  ]);

  const total = pageViewSessions.length;
  const maxDepthBySession = new Map<string, number>();
  for (const row of scrollRows) {
    const prev = maxDepthBySession.get(row.sessionId) ?? 0;
    if (row.depth > prev) maxDepthBySession.set(row.sessionId, row.depth);
  }

  const depths = Array.from(maxDepthBySession.values());
  const deciles = SCROLL_DECILES.map((depth) => {
    const reached = depths.filter((d) => d >= depth).length;
    return { depth, reached, pct: total > 0 ? (reached / total) * 100 : 0 };
  });
  const avgMaxDepth = depths.length > 0 ? depths.reduce((sum, d) => sum + d, 0) / depths.length : 0;
  const reachedHalfPct = deciles.find((d) => d.depth === 50)?.pct ?? 0;

  return { totalSessions: total, deciles, avgMaxDepth, reachedHalfPct };
}

export async function getSessionReplayChunks(sessionId: string) {
  return prisma.sessionReplay.findMany({
    where: { sessionId },
    orderBy: { seq: "asc" },
  });
}
