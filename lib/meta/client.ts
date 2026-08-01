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

async function graphFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const res = await fetch(graphUrl(path, params));
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error?.message ?? `Meta Graph API error (${res.status})`);
  }
  return body as T;
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
  const data = await graphFetch<{
    data: {
      id: string;
      name: string;
      status?: string;
      objective?: string;
      daily_budget?: string;
      lifetime_budget?: string;
      start_time?: string;
      stop_time?: string;
    }[];
  }>(`/${accountId}/campaigns`, {
    fields: "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time",
    access_token: accessToken,
    limit: "500",
  });
  return data.data;
}

export async function fetchAdSets(accessToken: string, campaignId: string) {
  const data = await graphFetch<{
    data: {
      id: string;
      name: string;
      status?: string;
      daily_budget?: string;
      lifetime_budget?: string;
      optimization_goal?: string;
      billing_event?: string;
      targeting?: unknown;
    }[];
  }>(`/${campaignId}/adsets`, {
    fields: "id,name,status,daily_budget,lifetime_budget,optimization_goal,billing_event,targeting",
    access_token: accessToken,
    limit: "500",
  });
  return data.data;
}

export async function fetchAds(accessToken: string, adSetId: string) {
  const data = await graphFetch<{
    data: {
      id: string;
      name: string;
      status?: string;
      creative?: { id?: string; title?: string; body?: string; thumbnail_url?: string; object_url?: string };
    }[];
  }>(`/${adSetId}/ads`, {
    fields: "id,name,status,creative{id,title,body,thumbnail_url,object_url}",
    access_token: accessToken,
    limit: "500",
  });
  return data.data;
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

export async function fetchInsights(
  accessToken: string,
  entityId: string,
  level: "campaign" | "adset" | "ad",
  since: string,
  until: string,
) {
  const data = await graphFetch<{ data: MetaInsightRow[] }>(`/${entityId}/insights`, {
    level,
    time_range: JSON.stringify({ since, until }),
    time_increment: "1",
    fields:
      "spend,impressions,reach,clicks,inline_link_clicks,frequency,ctr,cpc,cpm,actions,cost_per_action_type,video_30_sec_watched_actions",
    access_token: accessToken,
    limit: "500",
  });
  return data.data;
}
