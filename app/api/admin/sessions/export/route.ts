import { NextResponse } from "next/server";

import { getAdminSessionCookie, verifyAdminSessionToken } from "@/lib/auth/session";
import { getSessions } from "@/lib/admin/queries";
import { toCsv } from "@/lib/reports/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same order as the Sessions table: when and from which campaign first, the
// technical context after, the opaque IDs last.
const COLUMNS = [
  { header: "Status", key: "status" },
  { header: "Date", key: "date" },
  { header: "Time", key: "time" },
  { header: "Campaign", key: "utmCampaign" },
  { header: "Traffic Source", key: "trafficSource" },
  { header: "UTM Source", key: "utmSource" },
  { header: "UTM Medium", key: "utmMedium" },
  { header: "UTM Content", key: "utmContent" },
  { header: "UTM Term", key: "utmTerm" },
  { header: "Placement", key: "placement" },
  { header: "Meta Campaign ID", key: "metaCampaignId" },
  { header: "Meta Ad Set ID", key: "metaAdsetId" },
  { header: "Meta Ad ID", key: "metaAdId" },
  { header: "Click IDs", key: "clickIds" },
  { header: "URL Params", key: "urlParams" },
  { header: "Referrer", key: "referrer" },
  { header: "Visitor Type", key: "visitorType" },
  { header: "Landing Page", key: "entryPath" },
  { header: "Current Page", key: "currentPath" },
  { header: "Pages Viewed", key: "pagesViewed" },
  { header: "Duration (s)", key: "totalDuration" },
  { header: "Form Started", key: "formStarted" },
  { header: "Form Submitted", key: "formSubmitted" },
  { header: "CTA Clicked", key: "ctaClicked" },
  { header: "Bounce", key: "isBounce" },
  { header: "Avg Scroll %", key: "avgScrollPct" },
  { header: "Max Scroll %", key: "maxScrollPct" },
  { header: "Mouse Clicks", key: "mouseClicks" },
  { header: "Mouse Movements", key: "mouseMovements" },
  { header: "Country", key: "country" },
  { header: "City", key: "city" },
  { header: "Region", key: "region" },
  { header: "Timezone", key: "timezone" },
  { header: "Device", key: "deviceType" },
  { header: "Operating System", key: "os" },
  { header: "Browser", key: "browser" },
  { header: "Screen Resolution", key: "screenResolution" },
  { header: "Language", key: "language" },
  { header: "Network", key: "network" },
  { header: "IP Address", key: "ipAddress" },
  { header: "Visit Time", key: "startedAt" },
  { header: "Session ID", key: "id" },
  { header: "Visitor ID", key: "visitorId" },
];

export async function GET(request: Request) {
  const token = await getAdminSessionCookie();
  const isValid = await verifyAdminSessionToken(token);
  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const days = url.searchParams.get("days");

  const rows = await getSessions(
    {
      days: days ? Number(days) : undefined,
      visitorType: (url.searchParams.get("visitorType") as "new" | "returning" | "all" | null) ?? undefined,
      country: url.searchParams.get("country") ?? undefined,
      city: url.searchParams.get("city") ?? undefined,
      device: url.searchParams.get("device") ?? undefined,
      browser: url.searchParams.get("browser") ?? undefined,
      os: url.searchParams.get("os") ?? undefined,
      source: url.searchParams.get("source") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
    },
    2000,
  );

  const exportRows = rows.map((row) => ({
    ...row,
    visitorType: row.isReturning ? "Returning" : "New",
    screenResolution: row.screenWidth && row.screenHeight ? `${row.screenWidth}x${row.screenHeight}` : "",
    // Date and time split out for spreadsheet grouping; the ISO stamp stays as
    // the machine-readable column.
    date: row.startedAt.toISOString().slice(0, 10),
    time: row.startedAt.toISOString().slice(11, 19),
    urlParams: row.rawParams?.full.replace(/\n/g, "; ") ?? "",
    startedAt: row.startedAt.toISOString(),
  }));

  const csv = toCsv(COLUMNS, exportRows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="sessions.csv"`,
    },
  });
}
