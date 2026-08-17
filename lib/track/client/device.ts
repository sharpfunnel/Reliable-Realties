"use client";

// In-app browsers (Facebook, Instagram, ...) append their own vendor token to
// an otherwise normal Chrome/Safari UA, and iOS ones go further and strip the
// "Version/... Safari" segment the generic Safari check below depends on —
// so these must be checked first, by vendor token, rather than left to fall
// through to "Unknown".
const IN_APP_PATTERNS: [RegExp, string][] = [
  [/FBAN|FBAV|FB_IAB/, "Facebook"],
  [/Instagram/, "Instagram"],
  [/BytedanceWebview|musical_ly|TikTok/, "TikTok"],
  [/LinkedInApp/, "LinkedIn"],
  [/Snapchat/, "Snapchat"],
  [/\[LinE\]|Line\//, "Line"],
  [/Twitter/, "Twitter"],
  [/\bWhatsApp\//, "WhatsApp"],
];

function parseBrowser(ua: string): { browser: string; browserVersion?: string } {
  for (const [re, name] of IN_APP_PATTERNS) {
    if (re.test(ua)) return { browser: `${name} (in-app)` };
  }

  const patterns: [RegExp, string][] = [
    [/Edg\/([\d.]+)/, "Edge"],
    [/OPR\/([\d.]+)/, "Opera"],
    [/SamsungBrowser\/([\d.]+)/, "Samsung Internet"],
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

const WINDOWS_VERSIONS: Record<string, string> = {
  "10.0": "10",
  "6.3": "8.1",
  "6.2": "8",
  "6.1": "7",
  "6.0": "Vista",
  "5.1": "XP",
};

function parseOS(ua: string): { os: string; osVersion?: string } {
  if (/Windows NT ([\d.]+)/.test(ua)) {
    const [, nt] = ua.match(/Windows NT ([\d.]+)/)!;
    return { os: "Windows", osVersion: WINDOWS_VERSIONS[nt] };
  }
  if (/(iPhone|iPad|iPod)/.test(ua)) {
    const match = ua.match(/OS ([\d_]+)/);
    return { os: "iOS", osVersion: match?.[1].replace(/_/g, ".") };
  }
  if (/Mac OS X/.test(ua)) {
    const match = ua.match(/Mac OS X ([\d_]+)/);
    return { os: "macOS", osVersion: match?.[1].replace(/_/g, ".") };
  }
  if (/Android/.test(ua)) {
    const match = ua.match(/Android ([\d.]+)/);
    return { os: "Android", osVersion: match?.[1] };
  }
  if (/Linux/.test(ua)) return { os: "Linux" };
  return { os: "Unknown" };
}

type NetworkInformation = { effectiveType?: string; downlink?: number };

function getConnectionInfo(): { network?: string; downlink?: number } {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (!connection) return {};
  return { network: connection.effectiveType, downlink: connection.downlink };
}

function parseDeviceType(ua: string): string {
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android(?!.*Tablet)|iPhone/i.test(ua)) return "mobile";
  return "desktop";
}

// navigator.userAgent never changes mid-session, but getDeviceInfo() is
// called synchronously from click-adjacent code (form submit handlers, the
// tracking queue's threshold-triggered flush) — re-running ~20 regexes
// against it on every call adds avoidable work to those interaction paths.
let uaParseCache: { ua: string; browser: string; browserVersion?: string; os: string; osVersion?: string } | null =
  null;

function parseUa(ua: string) {
  if (uaParseCache?.ua === ua) return uaParseCache;
  const { browser, browserVersion } = parseBrowser(ua);
  const { os, osVersion } = parseOS(ua);
  uaParseCache = { ua, browser, browserVersion, os, osVersion };
  return uaParseCache;
}

export function getDeviceInfo() {
  const ua = navigator.userAgent;
  const { browser, browserVersion, os, osVersion } = parseUa(ua);
  const { network, downlink } = getConnectionInfo();

  return {
    screenWidth: window.screen?.width,
    screenHeight: window.screen?.height,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    browser,
    browserVersion,
    os,
    osVersion,
    deviceType: parseDeviceType(ua),
    network,
    downlink,
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
