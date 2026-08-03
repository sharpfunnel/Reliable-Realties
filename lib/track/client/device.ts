"use client";

function parseBrowser(ua: string): { browser: string; browserVersion?: string } {
  const patterns: [RegExp, string][] = [
    [/Edg\/([\d.]+)/, "Edge"],
    [/OPR\/([\d.]+)/, "Opera"],
    [/Chrome\/([\d.]+)/, "Chrome"],
    [/CriOS\/([\d.]+)/, "Chrome"],
    [/Firefox\/([\d.]+)/, "Firefox"],
    [/Version\/([\d.]+).*Safari/, "Safari"],
    [/MSIE ([\d.]+)/, "Internet Explorer"],
  ];
  for (const [re, name] of patterns) {
    const match = ua.match(re);
    if (match) return { browser: name, browserVersion: match[1] };
  }
  return { browser: "Unknown" };
}

function parseOS(ua: string): string {
  if (/Windows NT/.test(ua)) return "Windows";
  if (/Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua)) return "macOS";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown";
}

function parseDeviceType(ua: string): string {
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android(?!.*Tablet)|iPhone/i.test(ua)) return "mobile";
  return "desktop";
}

export function getDeviceInfo() {
  const ua = navigator.userAgent;
  const { browser, browserVersion } = parseBrowser(ua);

  return {
    screenWidth: window.screen?.width,
    screenHeight: window.screen?.height,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    browser,
    browserVersion,
    os: parseOS(ua),
    deviceType: parseDeviceType(ua),
  };
}

const SESSION_META_KEY = "rr_smeta";

export type SessionEntryMeta = {
  entryPath: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  gclid?: string;
  fbclid?: string;
  msclkid?: string;
  placement?: string;
  metaCampaignId?: string;
  metaAdsetId?: string;
  metaAdId?: string;
  /** Every query param on the landing URL, verbatim — a catch-all so no
   *  acquisition signal is lost even if it isn't one of the fields above. */
  rawParams: Record<string, string>;
};

/**
 * Reads the acquisition params once per session, on the landing pageview, and
 * caches the result in sessionStorage. Without the cache, a visitor who lands
 * on `/?utm_source=meta` and then clicks through to a page with no query string
 * would have their attribution overwritten with blanks on the next beacon flush.
 */
function getOrCreateEntryMeta(): SessionEntryMeta {
  try {
    const cached = sessionStorage.getItem(SESSION_META_KEY);
    if (cached) return JSON.parse(cached) as SessionEntryMeta;
  } catch {
    // storage unreadable (Safari private mode, in-app webviews) — read fresh
  }

  const params = new URLSearchParams(window.location.search);
  const param = (key: string) => params.get(key) ?? undefined;

  const meta: SessionEntryMeta = {
    entryPath: window.location.pathname,
    referrer: document.referrer || undefined,
    utmSource: param("utm_source"),
    utmMedium: param("utm_medium"),
    utmCampaign: param("utm_campaign"),
    utmContent: param("utm_content"),
    utmTerm: param("utm_term"),
    gclid: param("gclid"),
    fbclid: param("fbclid"),
    msclkid: param("msclkid"),
    // Meta fills these in per click when the ad URL uses its dynamic params
    // ({{placement}}, {{campaign.id}}, {{adset.id}}, {{ad.id}}).
    placement: param("placement"),
    metaCampaignId: param("campaign_id"),
    metaAdsetId: param("adset_id"),
    metaAdId: param("ad_id"),
    rawParams: Object.fromEntries(params.entries()),
  };

  try {
    sessionStorage.setItem(SESSION_META_KEY, JSON.stringify(meta));
  } catch {
    // fail open: this payload still carries the attribution, we just can't cache it
  }

  return meta;
}

export function getSessionInit() {
  return {
    ...getOrCreateEntryMeta(),
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}
