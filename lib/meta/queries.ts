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

  /**
   * On-site sessions are matched to a campaign by Meta's own campaign ID
   * (captured as `campaign_id` on the ad URL), because campaign names get
   * edited after launch and a rename would silently break a name-based join.
   * Sessions with no `metaCampaignId` — captured before we started tagging —
   * fall back to matching on the name, and the two buckets are kept separate
   * so a session carrying both isn't counted twice.
   */
  const sessionsByCampaign = await prisma.session.groupBy({
    by: ["metaCampaignId", "utmCampaign"],
    where: {
      startedAt: { gte: since },
      OR: [{ metaCampaignId: { not: null } }, { utmCampaign: { not: null } }],
    },
    _count: { _all: true },
  });

  const sessionsByMetaId = new Map<string, number>();
  const sessionsByName = new Map<string, number>();
  for (const row of sessionsByCampaign) {
    if (row.metaCampaignId) {
      sessionsByMetaId.set(
        row.metaCampaignId,
        (sessionsByMetaId.get(row.metaCampaignId) ?? 0) + row._count._all,
      );
    } else if (row.utmCampaign) {
      sessionsByName.set(row.utmCampaign, (sessionsByName.get(row.utmCampaign) ?? 0) + row._count._all);
    }
  }

  const leadsByCampaign = await prisma.lead.findMany({
    where: {
      createdAt: { gte: since },
      session: { OR: [{ metaCampaignId: { not: null } }, { utmCampaign: { not: null } }] },
    },
    select: { session: { select: { metaCampaignId: true, utmCampaign: true } } },
  });

  const leadsByMetaId = new Map<string, number>();
  const leadsByName = new Map<string, number>();
  for (const lead of leadsByCampaign) {
    const metaId = lead.session?.metaCampaignId;
    const name = lead.session?.utmCampaign;
    if (metaId) leadsByMetaId.set(metaId, (leadsByMetaId.get(metaId) ?? 0) + 1);
    else if (name) leadsByName.set(name, (leadsByName.get(name) ?? 0) + 1);
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
      onSiteSessions: (sessionsByMetaId.get(campaign.metaId) ?? 0) + (sessionsByName.get(campaign.name) ?? 0),
      onSiteLeads: (leadsByMetaId.get(campaign.metaId) ?? 0) + (leadsByName.get(campaign.name) ?? 0),
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
