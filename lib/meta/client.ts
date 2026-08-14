import "server-only";

function graphVersion() {
  return process.env.META_GRAPH_API_VERSION || "v21.0";
}

function graphUrl(path: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/${graphVersion()}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

/**
 * Meta error codes worth retrying: transient/unknown (1, 2), the four flavours
 * of rate limiting (4 app-level, 17 user-level, 32 page-level, 613 custom-rate),
 * and 80004 for the Ads Insights bucket specifically. Everything else — bad
 * token, missing permission, unknown field — will fail identically on a retry.
 */
const RETRYABLE_CODES = new Set([1, 2, 4, 17, 32, 613, 80000, 80003, 80004]);
const MAX_ATTEMPTS = 3;

class GraphApiError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly subcode?: number,
    readonly traceId?: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GraphApiError";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function graphFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  let lastError: GraphApiError | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let body: { error?: { message?: string; code?: number; error_subcode?: number; fbtrace_id?: string } };
    let status: number;

    try {
      const res = await fetch(graphUrl(path, params));
      status = res.status;
      body = await res.json();
      if (res.ok) return body as T;
    } catch (cause) {
      // Network-level failure — no response to inspect, but worth another go.
      lastError = new GraphApiError(cause instanceof Error ? cause.message : "Meta Graph API request failed");
      if (attempt === MAX_ATTEMPTS) throw lastError;
      await sleep(2 ** attempt * 500);
      continue;
    }

    const error = body?.error;
    lastError = new GraphApiError(
      // fbtrace_id is what Meta support asks for first, so keep it on the message
      // and not just the field — this surfaces in MetaAdAccount.lastSyncError.
      `${error?.message ?? `Meta Graph API error (${status})`}${error?.fbtrace_id ? ` [trace ${error.fbtrace_id}]` : ""}`,
      error?.code,
      error?.error_subcode,
      error?.fbtrace_id,
      status,
    );

    if (attempt === MAX_ATTEMPTS || error?.code === undefined || !RETRYABLE_CODES.has(error.code)) {
      throw lastError;
    }

    await sleep(2 ** attempt * 500);
  }

  throw lastError ?? new GraphApiError("Meta Graph API error");
}

type Paged<T> = { data: T[]; paging?: { cursors?: { after?: string }; next?: string } };

/**
 * Follows `paging.cursors.after` until the edge is exhausted. Every list
 * endpoint here needs this — a single page silently truncates at `limit`, which
 * would make spend totals quietly wrong rather than visibly broken.
 */
async function graphFetchAll<T>(
  path: string,
  params: Record<string, string> = {},
  maxPages = 25,
): Promise<T[]> {
  const rows: T[] = [];
  let after: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const body = await graphFetch<Paged<T>>(path, after ? { ...params, after } : params);
    rows.push(...(body.data ?? []));

    after = body.paging?.cursors?.after;
    // Meta omits `paging.next` on the final page even when a cursor is present.
    if (!after || !body.paging?.next) break;
  }

  return rows;
}

export function buildOAuthDialogUrl(state: string) {
  const appId = process.env.META_APP_ID;
  const redirectUri = process.env.META_REDIRECT_URI;
  if (!appId || !redirectUri) {
    throw new Error("META_APP_ID / META_REDIRECT_URI are not configured");
  }
  const url = new URL(`https://www.facebook.com/${graphVersion()}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "ads_read,ads_management,business_management");
  return url.toString();
}

export async function exchangeCodeForToken(code: string) {
  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  const redirectUri = process.env.META_REDIRECT_URI!;

  const shortLived = await graphFetch<{ access_token: string; expires_in?: number }>("/oauth/access_token", {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });

  const longLived = await graphFetch<{ access_token: string; expires_in?: number }>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLived.access_token,
  });

  return {
    accessToken: longLived.access_token,
    expiresInSeconds: longLived.expires_in ?? 60 * 24 * 3600,
  };
}

export async function refreshLongLivedToken(accessToken: string) {
  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;

  const refreshed = await graphFetch<{ access_token: string; expires_in?: number }>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: accessToken,
  });

  return {
    accessToken: refreshed.access_token,
    expiresInSeconds: refreshed.expires_in ?? 60 * 24 * 3600,
  };
}

export async function listAdAccounts(accessToken: string) {
  const data = await graphFetch<{
    data: { id: string; name?: string; currency?: string; timezone_name?: string }[];
  }>("/me/adaccounts", {
    fields: "id,name,currency,timezone_name",
    access_token: accessToken,
  });
  return data.data;
}

export async function fetchCampaigns(accessToken: string, accountId: string) {
  return graphFetchAll<{
    id: string;
    name: string;
    status?: string;
    objective?: string;
    daily_budget?: string;
    lifetime_budget?: string;
    start_time?: string;
    stop_time?: string;
  }>(`/${accountId}/campaigns`, {
    fields: "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time",
    access_token: accessToken,
    limit: "500",
  });
}

export async function fetchAdSets(accessToken: string, campaignId: string) {
  return graphFetchAll<{
    id: string;
    name: string;
    status?: string;
    daily_budget?: string;
    lifetime_budget?: string;
    optimization_goal?: string;
    billing_event?: string;
    targeting?: unknown;
  }>(`/${campaignId}/adsets`, {
    fields: "id,name,status,daily_budget,lifetime_budget,optimization_goal,billing_event,targeting",
    access_token: accessToken,
    limit: "500",
  });
}

export async function fetchAds(accessToken: string, adSetId: string) {
  return graphFetchAll<{
    id: string;
    name: string;
    status?: string;
    creative?: { id?: string; title?: string; body?: string; thumbnail_url?: string; object_url?: string };
  }>(`/${adSetId}/ads`, {
    fields: "id,name,status,creative{id,title,body,thumbnail_url,object_url}",
    access_token: accessToken,
    limit: "500",
  });
}

export type MetaInsightRow = {
  date_start: string;
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  inline_link_clicks?: string;
  frequency?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
  video_30_sec_watched_actions?: { action_type: string; value: string }[];
  website_ctr?: { action_type: string; value: string }[];
};

/**
 * Pulls daily insights for every entity at `level` in one paged request against
 * the ad account node, rather than one request per campaign/ad set/ad. Each row
 * carries `campaign_id`/`adset_id`/`ad_id` so the caller can still attribute it.
 */
export async function fetchAccountInsights(
  accessToken: string,
  accountId: string,
  level: "campaign" | "adset" | "ad",
  since: string,
  until: string,
) {
  return graphFetchAll<MetaInsightRow>(`/${accountId}/insights`, {
    level,
    time_range: JSON.stringify({ since, until }),
    time_increment: "1",
    fields:
      "campaign_id,adset_id,ad_id,spend,impressions,reach,clicks,inline_link_clicks,frequency,ctr,cpc,cpm,actions,cost_per_action_type,video_30_sec_watched_actions",
    access_token: accessToken,
    limit: "500",
  });
}
