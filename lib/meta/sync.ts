import "server-only";

import { prisma } from "@/lib/db";
import {
  fetchAccountInsights,
  fetchAdSets,
  fetchAds,
  fetchCampaigns,
  refreshLongLivedToken,
  type MetaInsightRow,
} from "@/lib/meta/client";

const TOKEN_REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
/** Must cover the widest range the admin UI offers (90D), or that view silently under-reports spend. */
const INSIGHTS_LOOKBACK_DAYS = 90;
/** How many insight rows to upsert concurrently — enough to matter, short of exhausting the pool. */
const UPSERT_CONCURRENCY = 25;

function num(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function actionValue(row: MetaInsightRow, actionType: string): number | undefined {
  const entry = row.actions?.find((a) => a.action_type === actionType);
  return entry ? Number(entry.value) : undefined;
}

function videoViewValue(row: MetaInsightRow): number | undefined {
  const entries = row.video_30_sec_watched_actions;
  if (!entries?.length) return undefined;
  return entries.reduce((sum, entry) => sum + Number(entry.value ?? 0), 0);
}

async function upsertInsight(
  level: "campaign" | "adset" | "ad",
  entityId: string,
  row: MetaInsightRow,
  fk: { campaignId?: string; adSetId?: string; adId?: string },
) {
  const date = new Date(row.date_start);
  const spend = num(row.spend);
  const results = actionValue(row, "lead");
  const landingPageViews = actionValue(row, "landing_page_view");

  const metrics = {
    spend,
    impressions: num(row.impressions),
    reach: num(row.reach),
    clicks: num(row.clicks),
    linkClicks: num(row.inline_link_clicks),
    landingPageViews,
    ctr: num(row.ctr),
    cpc: num(row.cpc),
    cpm: num(row.cpm),
    frequency: num(row.frequency),
    videoViews: videoViewValue(row),
    results,
    costPerResult: results && spend ? spend / results : undefined,
  };

  await prisma.metaInsight.upsert({
    where: { level_entityId_date: { level, entityId, date } },
    create: {
      level,
      entityId,
      date,
      campaignId: fk.campaignId,
      adSetId: fk.adSetId,
      adId: fk.adId,
      ...metrics,
    },
    update: metrics,
  });
}

/**
 * One paged request per level against the ad account node, instead of one per
 * campaign/ad set/ad. Rows arrive tagged with `campaign_id`/`adset_id`/`ad_id`,
 * which the caller's Meta-id → local-id maps turn back into foreign keys.
 */
async function syncInsightsForAccount(
  accessToken: string,
  accountId: string,
  level: "campaign" | "adset" | "ad",
  resolve: (row: MetaInsightRow) =>
    | { entityId: string; fk: { campaignId?: string; adSetId?: string; adId?: string } }
    | null,
) {
  const until = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - INSIGHTS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const rows = await fetchAccountInsights(accessToken, accountId, level, since, until);

  for (let i = 0; i < rows.length; i += UPSERT_CONCURRENCY) {
    await Promise.all(
      rows.slice(i, i + UPSERT_CONCURRENCY).map((row) => {
        const resolved = resolve(row);
        // An entity created between the hierarchy fetch and the insights fetch
        // has no local row yet; it will be picked up on the next sync.
        if (!resolved) return undefined;
        return upsertInsight(level, resolved.entityId, row, resolved.fk);
      }),
    );
  }
}

async function syncAccount(account: { id: string; accountId: string; accessToken: string | null; tokenExpiresAt: Date | null }) {
  if (!account.accessToken) return;

  let accessToken = account.accessToken;

  if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() - Date.now() < TOKEN_REFRESH_THRESHOLD_MS) {
    const refreshed = await refreshLongLivedToken(accessToken);
    accessToken = refreshed.accessToken;
    await prisma.metaAdAccount.update({
      where: { id: account.id },
      data: {
        accessToken,
        tokenExpiresAt: new Date(Date.now() + refreshed.expiresInSeconds * 1000),
      },
    });
  }

  const campaigns = await fetchCampaigns(accessToken, account.accountId);

  // Meta id → local cuid, accumulated while walking the hierarchy so the
  // account-level insight rows below can be attributed without extra queries.
  const campaignIds = new Map<string, string>();
  const adSetIds = new Map<string, { id: string; campaignId: string }>();
  const adIds = new Map<string, { id: string; adSetId: string; campaignId: string }>();

  for (const c of campaigns) {
    const campaign = await prisma.campaign.upsert({
      where: { metaId: c.id },
      create: {
        adAccountId: account.id,
        metaId: c.id,
        name: c.name,
        status: c.status,
        objective: c.objective,
        dailyBudget: c.daily_budget ? Number(c.daily_budget) / 100 : undefined,
        lifetimeBudget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : undefined,
        startTime: c.start_time ? new Date(c.start_time) : undefined,
        stopTime: c.stop_time ? new Date(c.stop_time) : undefined,
      },
      update: {
        name: c.name,
        status: c.status,
        objective: c.objective,
        dailyBudget: c.daily_budget ? Number(c.daily_budget) / 100 : undefined,
        lifetimeBudget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : undefined,
        startTime: c.start_time ? new Date(c.start_time) : undefined,
        stopTime: c.stop_time ? new Date(c.stop_time) : undefined,
      },
    });

    campaignIds.set(c.id, campaign.id);

    const adSets = await fetchAdSets(accessToken, c.id);
    for (const as of adSets) {
      const adSet = await prisma.adSet.upsert({
        where: { metaId: as.id },
        create: {
          campaignId: campaign.id,
          metaId: as.id,
          name: as.name,
          status: as.status,
          dailyBudget: as.daily_budget ? Number(as.daily_budget) / 100 : undefined,
          lifetimeBudget: as.lifetime_budget ? Number(as.lifetime_budget) / 100 : undefined,
          optimizationGoal: as.optimization_goal,
          billingEvent: as.billing_event,
          targeting: as.targeting ?? undefined,
        },
        update: {
          name: as.name,
          status: as.status,
          dailyBudget: as.daily_budget ? Number(as.daily_budget) / 100 : undefined,
          lifetimeBudget: as.lifetime_budget ? Number(as.lifetime_budget) / 100 : undefined,
          optimizationGoal: as.optimization_goal,
          billingEvent: as.billing_event,
          targeting: as.targeting ?? undefined,
        },
      });

      adSetIds.set(as.id, { id: adSet.id, campaignId: campaign.id });

      const ads = await fetchAds(accessToken, as.id);
      for (const ad of ads) {
        const adRow = await prisma.ad.upsert({
          where: { metaId: ad.id },
          create: {
            adSetId: adSet.id,
            metaId: ad.id,
            name: ad.name,
            status: ad.status,
            creativeId: ad.creative?.id,
            headline: ad.creative?.title,
            bodyText: ad.creative?.body,
            thumbnailUrl: ad.creative?.thumbnail_url,
            linkUrl: ad.creative?.object_url,
          },
          update: {
            name: ad.name,
            status: ad.status,
            creativeId: ad.creative?.id,
            headline: ad.creative?.title,
            bodyText: ad.creative?.body,
            thumbnailUrl: ad.creative?.thumbnail_url,
            linkUrl: ad.creative?.object_url,
          },
        });

        adIds.set(ad.id, { id: adRow.id, adSetId: adSet.id, campaignId: campaign.id });
      }
    }
  }

  await syncInsightsForAccount(accessToken, account.accountId, "campaign", (row) => {
    const localId = row.campaign_id ? campaignIds.get(row.campaign_id) : undefined;
    return localId ? { entityId: row.campaign_id!, fk: { campaignId: localId } } : null;
  });

  await syncInsightsForAccount(accessToken, account.accountId, "adset", (row) => {
    const adSet = row.adset_id ? adSetIds.get(row.adset_id) : undefined;
    return adSet
      ? { entityId: row.adset_id!, fk: { campaignId: adSet.campaignId, adSetId: adSet.id } }
      : null;
  });

  await syncInsightsForAccount(accessToken, account.accountId, "ad", (row) => {
    const ad = row.ad_id ? adIds.get(row.ad_id) : undefined;
    return ad
      ? { entityId: row.ad_id!, fk: { campaignId: ad.campaignId, adSetId: ad.adSetId, adId: ad.id } }
      : null;
  });
}

export async function syncAllMetaAdAccounts() {
  const accounts = await prisma.metaAdAccount.findMany({ where: { accessToken: { not: null } } });

  const results = await Promise.allSettled(
    accounts.map(async (account) => {
      try {
        await syncAccount(account);
        await prisma.metaAdAccount.update({
          where: { id: account.id },
          data: { lastSyncedAt: new Date(), lastSyncError: null },
        });
      } catch (error) {
        await prisma.metaAdAccount.update({
          where: { id: account.id },
          data: { lastSyncError: error instanceof Error ? error.message : "Unknown sync error" },
        });
        throw error;
      }
    }),
  );

  return {
    synced: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
  };
}
