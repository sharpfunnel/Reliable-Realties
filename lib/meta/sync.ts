import "server-only";

import { prisma } from "@/lib/db";
import {
  fetchAdSets,
  fetchAds,
  fetchCampaigns,
  fetchInsights,
  refreshLongLivedToken,
  type MetaInsightRow,
} from "@/lib/meta/client";

const TOKEN_REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
const INSIGHTS_LOOKBACK_DAYS = 30;

function num(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function actionValue(row: MetaInsightRow, actionType: string): number | undefined {
  const entry = row.actions?.find((a) => a.action_type === actionType);
  return entry ? Number(entry.value) : undefined;
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

  await prisma.metaInsight.upsert({
    where: { level_entityId_date: { level, entityId, date } },
    create: {
      level,
      entityId,
      date,
      campaignId: fk.campaignId,
      adSetId: fk.adSetId,
      adId: fk.adId,
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
      results,
      costPerResult: results && spend ? spend / results : undefined,
    },
    update: {
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
      results,
      costPerResult: results && spend ? spend / results : undefined,
    },
  });
}

async function syncInsightsFor(
  accessToken: string,
  level: "campaign" | "adset" | "ad",
  entityId: string,
  fk: { campaignId?: string; adSetId?: string; adId?: string },
) {
  const until = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - INSIGHTS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const rows = await fetchInsights(accessToken, entityId, level, since, until);
  for (const row of rows) {
    await upsertInsight(level, entityId, row, fk);
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

    await syncInsightsFor(accessToken, "campaign", c.id, { campaignId: campaign.id });

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

      await syncInsightsFor(accessToken, "adset", as.id, { campaignId: campaign.id, adSetId: adSet.id });

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

        await syncInsightsFor(accessToken, "ad", ad.id, {
          campaignId: campaign.id,
          adSetId: adSet.id,
          adId: adRow.id,
        });
      }
    }
  }
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
