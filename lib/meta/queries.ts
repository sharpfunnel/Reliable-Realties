import "server-only";

import { prisma } from "@/lib/db";

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getMetaAdAccounts() {
  return prisma.metaAdAccount.findMany({ orderBy: { connectedAt: "desc" } });
}

export async function getMetaSummaryStats(days = 30) {
  const since = daysAgo(days);

  const agg = await prisma.metaInsight.aggregate({
    where: { level: "campaign", date: { gte: since } },
    _sum: {
      spend: true,
      impressions: true,
      clicks: true,
      linkClicks: true,
      landingPageViews: true,
      results: true,
    },
  });

  const spend = agg._sum.spend ?? 0;
  const results = agg._sum.results ?? 0;
  const clicks = agg._sum.clicks ?? 0;
  const impressions = agg._sum.impressions ?? 0;

  return {
    spend,
    impressions,
    clicks,
    linkClicks: agg._sum.linkClicks ?? 0,
    landingPageViews: agg._sum.landingPageViews ?? 0,
    results,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    costPerResult: results > 0 ? spend / results : 0,
  };
}

export async function getCampaignPerformance(days = 30) {
  const since = daysAgo(days);

  const campaigns = await prisma.campaign.findMany({
    include: {
      insights: { where: { date: { gte: since } } },
      adAccount: { select: { name: true, currency: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const onSiteByUtm = await prisma.session.groupBy({
    by: ["utmCampaign"],
    where: { startedAt: { gte: since }, utmCampaign: { not: null } },
    _count: { _all: true },
  });
  const onSiteMap = new Map(onSiteByUtm.map((r) => [r.utmCampaign, r._count._all]));

  const leadsByUtm = await prisma.lead.findMany({
    where: { createdAt: { gte: since }, session: { utmCampaign: { not: null } } },
    select: { session: { select: { utmCampaign: true } } },
  });
  const leadsMap = new Map<string, number>();
  for (const lead of leadsByUtm) {
    const key = lead.session?.utmCampaign;
    if (key) leadsMap.set(key, (leadsMap.get(key) ?? 0) + 1);
  }

  return campaigns.map((campaign) => {
    const spend = campaign.insights.reduce((sum, i) => sum + (i.spend ?? 0), 0);
    const results = campaign.insights.reduce((sum, i) => sum + (i.results ?? 0), 0);
    const impressions = campaign.insights.reduce((sum, i) => sum + (i.impressions ?? 0), 0);
    const clicks = campaign.insights.reduce((sum, i) => sum + (i.clicks ?? 0), 0);

    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      accountName: campaign.adAccount.name,
      currency: campaign.adAccount.currency,
      spend,
      impressions,
      clicks,
      results,
      costPerResult: results > 0 ? spend / results : 0,
      onSiteSessions: onSiteMap.get(campaign.name) ?? 0,
      onSiteLeads: leadsMap.get(campaign.name) ?? 0,
    };
  });
}

export async function getCampaignDetail(campaignId: string, days = 30) {
  const since = daysAgo(days);

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      adAccount: true,
      adSets: {
        include: {
          insights: { where: { date: { gte: since } } },
          ads: {
            include: {
              insights: { where: { date: { gte: since } } },
            },
          },
        },
      },
    },
  });

  if (!campaign) return null;

  return {
    ...campaign,
    adSets: campaign.adSets.map((adSet) => {
      const spend = adSet.insights.reduce((sum, i) => sum + (i.spend ?? 0), 0);
      const clicks = adSet.insights.reduce((sum, i) => sum + (i.clicks ?? 0), 0);
      const impressions = adSet.insights.reduce((sum, i) => sum + (i.impressions ?? 0), 0);
      const results = adSet.insights.reduce((sum, i) => sum + (i.results ?? 0), 0);

      return {
        ...adSet,
        spend,
        clicks,
        impressions,
        results,
        cpc: clicks > 0 ? spend / clicks : 0,
        cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
        ads: adSet.ads.map((ad) => {
          const adSpend = ad.insights.reduce((sum, i) => sum + (i.spend ?? 0), 0);
          const adClicks = ad.insights.reduce((sum, i) => sum + (i.clicks ?? 0), 0);
          const adImpressions = ad.insights.reduce((sum, i) => sum + (i.impressions ?? 0), 0);
          const adResults = ad.insights.reduce((sum, i) => sum + (i.results ?? 0), 0);

          return {
            ...ad,
            spend: adSpend,
            clicks: adClicks,
            impressions: adImpressions,
            results: adResults,
            ctr: adImpressions > 0 ? (adClicks / adImpressions) * 100 : 0,
            cpc: adClicks > 0 ? adSpend / adClicks : 0,
            cpm: adImpressions > 0 ? (adSpend / adImpressions) * 1000 : 0,
          };
        }),
      };
    }),
  };
}
