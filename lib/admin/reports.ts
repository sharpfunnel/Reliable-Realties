import "server-only";

import { prisma } from "@/lib/db";

export type ReportRange = { from: Date; to: Date };

export function resolveReportRange(params: { from?: string; to?: string }): ReportRange {
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  defaultFrom.setHours(0, 0, 0, 0);

  const from = params.from ? new Date(params.from) : defaultFrom;
  const to = params.to ? new Date(params.to) : now;

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { from: defaultFrom, to: now };
  }

  const inclusiveTo = new Date(to);
  inclusiveTo.setHours(23, 59, 59, 999);

  return { from, to: inclusiveTo };
}

export async function getReportOverview(range: ReportRange) {
  const where = { gte: range.from, lte: range.to };

  const [visitors, sessions, leads, ctaClicks] = await Promise.all([
    prisma.visitor.count({ where: { firstSeenAt: where } }),
    prisma.session.count({ where: { startedAt: where } }),
    prisma.lead.count({ where: { createdAt: where } }),
    prisma.ctaEvent.count({ where: { createdAt: where, action: "clicked" } }),
  ]);

  return {
    range,
    visitors,
    sessions,
    leads,
    ctaClicks,
    conversionRate: sessions > 0 ? (leads / sessions) * 100 : 0,
  };
}

export async function getReportLeads(range: ReportRange) {
  return prisma.lead.findMany({
    where: { createdAt: { gte: range.from, lte: range.to } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getReportCampaigns(range: ReportRange) {
  const campaigns = await prisma.campaign.findMany({
    include: {
      adAccount: { select: { name: true, currency: true } },
      insights: { where: { date: { gte: range.from, lte: range.to } } },
    },
    orderBy: { name: "asc" },
  });

  return campaigns.map((c) => {
    const spend = c.insights.reduce((sum, i) => sum + (i.spend ?? 0), 0);
    const impressions = c.insights.reduce((sum, i) => sum + (i.impressions ?? 0), 0);
    const clicks = c.insights.reduce((sum, i) => sum + (i.clicks ?? 0), 0);
    const results = c.insights.reduce((sum, i) => sum + (i.results ?? 0), 0);

    return {
      name: c.name,
      status: c.status,
      accountName: c.adAccount.name,
      currency: c.adAccount.currency ?? "INR",
      spend,
      impressions,
      clicks,
      results,
      costPerResult: results > 0 ? spend / results : 0,
    };
  });
}
