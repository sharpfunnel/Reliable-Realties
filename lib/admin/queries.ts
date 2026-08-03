import "server-only";

import { prisma } from "@/lib/db";

export async function getNavCounts() {
  const [leads, sessions] = await Promise.all([
    prisma.lead.count(),
    prisma.session.count(),
  ]);
  return { leads, sessions };
}

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getOverviewStats(days = 30) {
  const since = daysAgo(days);

  const [visitors, sessions, leads, scrollers, ctaClicks, sessionsAgg] = await Promise.all([
    prisma.visitor.count({ where: { firstSeenAt: { gte: since } } }),
    prisma.session.count({ where: { startedAt: { gte: since } } }),
    prisma.lead.count({ where: { createdAt: { gte: since } } }),
    prisma.scrollEvent.findMany({
      where: { createdAt: { gte: since }, depth: { gte: 50 } },
      distinct: ["sessionId"],
      select: { sessionId: true },
    }),
    prisma.ctaEvent.count({ where: { createdAt: { gte: since }, action: "clicked" } }),
    prisma.session.aggregate({
      where: { startedAt: { gte: since }, totalDuration: { not: null } },
      _avg: { totalDuration: true },
    }),
  ]);

  const conversionRate = sessions > 0 ? (leads / sessions) * 100 : 0;

  return {
    visitors,
    sessions,
    leads,
    conversionRate,
    scrollersCount: scrollers.length,
    ctaClicks,
    avgSessionDuration: sessionsAgg._avg.totalDuration ?? 0,
  };
}

export async function getDailyTimeSeries(days = 30) {
  const since = daysAgo(days - 1);

  const [visitors, sessions, leads] = await Promise.all([
    prisma.visitor.findMany({
      where: { firstSeenAt: { gte: since } },
      select: { firstSeenAt: true },
    }),
    prisma.session.findMany({
      where: { startedAt: { gte: since } },
      select: { startedAt: true },
    }),
    prisma.lead.findMany({
      where: { createdAt: { gte: since } },
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
    where: { startedAt: { gte: since } },
    _count: { _all: true },
  });

  const leads = await prisma.lead.findMany({
    where: { createdAt: { gte: since }, sessionId: { not: null } },
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
      return {
        source: row.utmSource ?? "(direct)",
        medium: row.utmMedium ?? "—",
        campaign: row.utmCampaign ?? "—",
        sessions: row._count._all,
        leads: leadCounts.get(key) ?? 0,
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

export async function getLeads(status?: string) {
  return prisma.lead.findMany({
    where: status && status !== "all" ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      session: {
        select: {
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          utmContent: true,
          utmTerm: true,
          placement: true,
          gclid: true,
          fbclid: true,
          msclkid: true,
          rawParams: true,
        },
      },
    },
  });
}

export async function getSessions(limit = 100) {
  return prisma.session.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
    include: { visitor: true, _count: { select: { replays: true } } },
  });
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
    where: { createdAt: { gte: since } },
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
    where: { createdAt: { gte: since } },
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
      const [avg, good, needsImprovement, poor] = await Promise.all([
        prisma.performanceMetric.aggregate({
          where: { metric, createdAt: { gte: since } },
          _avg: { value: true },
          _count: { _all: true },
        }),
        prisma.performanceMetric.count({ where: { metric, rating: "good", createdAt: { gte: since } } }),
        prisma.performanceMetric.count({
          where: { metric, rating: "needs-improvement", createdAt: { gte: since } },
        }),
        prisma.performanceMetric.count({ where: { metric, rating: "poor", createdAt: { gte: since } } }),
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
    where: { startedAt: { gte: since }, ...sourceFilter },
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

export async function getHeatmapPaths() {
  const rows = await prisma.heatmapEvent.groupBy({
    by: ["path"],
    _count: { _all: true },
    orderBy: { _count: { path: "desc" } },
  });
  return rows.map((r) => r.path);
}

export async function getHeatmapPoints(path: string, type: "click" | "hover") {
  return prisma.heatmapEvent.findMany({
    where: { path, type },
    select: { xPct: true, yPct: true },
    orderBy: { createdAt: "desc" },
    take: 3000,
  });
}

export async function getSessionReplayMeta(sessionId: string) {
  return prisma.session.findUnique({
    where: { id: sessionId },
    include: { visitor: true },
  });
}

export async function getSessionReplayChunks(sessionId: string) {
  return prisma.sessionReplay.findMany({
    where: { sessionId },
    orderBy: { seq: "asc" },
  });
}
