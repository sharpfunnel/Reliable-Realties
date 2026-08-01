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

export function getSessionInit() {
  const params = new URLSearchParams(window.location.search);
  return {
    entryPath: window.location.pathname,
    referrer: document.referrer || undefined,
    utmSource: params.get("utm_source") ?? undefined,
    utmMedium: params.get("utm_medium") ?? undefined,
    utmCampaign: params.get("utm_campaign") ?? undefined,
    utmContent: params.get("utm_content") ?? undefined,
    utmTerm: params.get("utm_term") ?? undefined,
    gclid: params.get("gclid") ?? undefined,
    fbclid: params.get("fbclid") ?? undefined,
    msclkid: params.get("msclkid") ?? undefined,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}
