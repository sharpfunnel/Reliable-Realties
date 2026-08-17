import "server-only";

import { prisma } from "@/lib/db";
import { graphVersion } from "@/lib/meta/capi-payload";

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getMetaAdAccounts() {
  return prisma.metaAdAccount.findMany({ orderBy: { connectedAt: "desc" } });
}

/** Lets cost KPIs be hidden entirely rather than rendered as a misleading zero. */
export async function hasConnectedAdAccount() {
  return (await prisma.metaAdAccount.count({ where: { accessToken: { not: null } } })) > 0;
}

/** Currency of the most recently connected account, for formatting spend figures. */
async function getReportingCurrency() {
  const account = await prisma.metaAdAccount.findFirst({
    where: { accessToken: { not: null } },
    orderBy: { connectedAt: "desc" },
    select: { currency: true },
  });
  return account?.currency ?? "INR";
}

// ---------------------------------------------------------------------------
// Conversions API console (/admin/meta-capi)
// ---------------------------------------------------------------------------

export type CapiDiagnostics = {
  pixelIdSet: boolean;
  tokenSource: "env" | "adAccount" | "none";
  testEventCodeSet: boolean;
  graphVersion: string;
};

/**
 * Reports *whether* each piece of CAPI config is present. Deliberately returns
 * booleans only — no token or pixel value is ever handed to the client.
 * Mirrors `resolveAccessToken()` in lib/meta/capi.ts so the admin page reflects
 * what the live sender would actually resolve.
 */
export async function getCapiDiagnostics(): Promise<CapiDiagnostics> {
  let tokenSource: CapiDiagnostics["tokenSource"] = "none";
  if (process.env.META_CAPI_ACCESS_TOKEN) {
    tokenSource = "env";
  } else {
    const account = await prisma.metaAdAccount.findFirst({
      where: { accessToken: { not: null } },
      orderBy: { connectedAt: "desc" },
      select: { id: true },
    });
    if (account) tokenSource = "adAccount";
  }

  return {
    pixelIdSet: Boolean(process.env.META_PIXEL_ID),
    tokenSource,
    testEventCodeSet: Boolean(process.env.META_CAPI_TEST_EVENT_CODE),
    graphVersion: graphVersion(),
  };
}

export type CapiDeliveryRow = {
  id: string;
  name: string | null;
  email: string | null;
  createdAt: Date;
  metaCapiSentAt: Date | null;
  metaCapiError: string | null;
  status: "sent" | "failed" | "pending";
};

/**
 * `Lead.metaCapiSentAt` / `Lead.metaCapiError` are written by the live sender
 * but were never surfaced anywhere, so delivery failures were invisible.
 */
export async function getCapiDeliveryLog(limit = 50): Promise<CapiDeliveryRow[]> {
  const leads = await prisma.lead.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      metaCapiSentAt: true,
      metaCapiError: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return leads.map((lead) => ({
    ...lead,
    status: lead.metaCapiError ? "failed" : lead.metaCapiSentAt ? "sent" : "pending",
  }));
}

export async function getCapiDeliveryCounts() {
  const [total, sent, failed] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { metaCapiSentAt: { not: null }, metaCapiError: null } }),
    prisma.lead.count({ where: { metaCapiError: { not: null } } }),
  ]);
  return { total, sent, failed, pending: total - sent - failed };
}

export type CapiPrefillLead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  createdAt: Date;
  session: {
    fbclid: string | null;
    ipAddress: string | null;
    entryPath: string | null;
    userAgent: string | null;
    fbp: string | null;
    fbc: string | null;
  } | null;
};

const PREFILL_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  source: true,
  createdAt: true,
  session: {
    select: { fbclid: true, ipAddress: true, entryPath: true, userAgent: true, fbp: true, fbc: true },
  },
} as const;

export async function getLeadsForCapiPreview(limit = 25): Promise<CapiPrefillLead[]> {
  return prisma.lead.findMany({
    select: PREFILL_SELECT,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getLeadForCapiPreview(leadId: string): Promise<CapiPrefillLead | null> {
  return prisma.lead.findUnique({ where: { id: leadId }, select: PREFILL_SELECT });
}

export async function getMetaSummaryStats(days = 30) {
  const since = daysAgo(days);

  const [agg, currency] = await Promise.all([
    prisma.metaInsight.aggregate({
      where: { level: "campaign", date: { gte: since } },
      _sum: {
        spend: true,
        impressions: true,
        clicks: true,
        linkClicks: true,
        landingPageViews: true,
        results: true,
      },
    }),
    getReportingCurrency(),
  ]);

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
    currency,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    costPerResult: results > 0 ? spend / results : 0,
  };
}

export type SpendSeriesPoint = {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  /** Meta's own attributed lead count. */
  results: number;
  /** Leads we captured ourselves on an ad-tagged session. */
  leads: number;
};

/**
 * Daily spend paired with the leads we actually captured that day. `MetaInsight`
 * already stores per-day rows; nothing aggregated them by date until now.
 *
 * Days with no data are pre-filled with zeroes so a gap renders as a flat run
 * rather than silently compressing the x-axis — same convention as
 * `getDailyTimeSeries` in lib/admin/queries.ts.
 */
export async function getDailySpendSeries(days = 30): Promise<SpendSeriesPoint[]> {
  // Deliberately `daysAgo(days)`, not `days - 1`: every "last N days" figure in
  // this admin panel means "since N days ago", so the window spans N+1 calendar
  // days. Matching it is what keeps the chart's total equal to the Spend tile
  // sitting directly above it.
  const since = daysAgo(days);
  const bucketCount = days + 1;

  /**
   * `MetaInsight.date` is a calendar date Meta reported in the ad account's
   * timezone, stored as UTC midnight — so its day must be read in UTC. Lead
   * timestamps are real instants and belong to the day the reader is living in.
   * Bucketing both with `toISOString()` would shift the calendar days apart
   * behind any timezone east of UTC and silently drop today's spend.
   */
  const utcDayKey = (d: Date) => d.toISOString().slice(0, 10);
  const localDayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const [spendByDate, leads] = await Promise.all([
    prisma.metaInsight.groupBy({
      by: ["date"],
      where: { level: "campaign", date: { gte: since } },
      _sum: { spend: true, impressions: true, clicks: true, results: true },
    }),
    prisma.lead.findMany({
      where: {
        createdAt: { gte: since },
        session: { OR: [{ metaCampaignId: { not: null } }, { utmCampaign: { not: null } }] },
      },
      select: { createdAt: true },
    }),
  ]);

  const buckets = new Map<string, SpendSeriesPoint>();
  for (let i = 0; i < bucketCount; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = localDayKey(d);
    buckets.set(key, { date: key, spend: 0, impressions: 0, clicks: 0, results: 0, leads: 0 });
  }

  for (const row of spendByDate) {
    const bucket = buckets.get(utcDayKey(row.date));
    if (!bucket) continue;
    bucket.spend += row._sum.spend ?? 0;
    bucket.impressions += row._sum.impressions ?? 0;
    bucket.clicks += row._sum.clicks ?? 0;
    bucket.results += row._sum.results ?? 0;
  }

  for (const lead of leads) {
    const bucket = buckets.get(localDayKey(lead.createdAt));
    if (bucket) bucket.leads += 1;
  }

  return Array.from(buckets.values());
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
