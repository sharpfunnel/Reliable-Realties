import { NextResponse } from "next/server";

import { verifyAdminSession } from "@/lib/auth/dal";
import { getLeads, resolveLeadsDateRange } from "@/lib/admin/queries";
import { toCsv } from "@/lib/reports/csv";
import { buildWorkbookBuffer } from "@/lib/reports/excel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLUMNS = [
  { header: "Lead ID", key: "displayId" },
  { header: "Name", key: "name" },
  { header: "Phone", key: "phone" },
  { header: "Email", key: "email" },
  { header: "Budget", key: "budget" },
  { header: "Message", key: "message" },
  { header: "City", key: "city" },
  { header: "Country", key: "country" },
  { header: "Source", key: "source" },
  { header: "Campaign", key: "campaign" },
  { header: "UTM Source", key: "utmSource" },
  { header: "UTM Medium", key: "utmMedium" },
  { header: "UTM Campaign", key: "utmCampaign" },
  { header: "Device", key: "device" },
  { header: "Browser", key: "browser" },
  { header: "Operating System", key: "os" },
  { header: "IP Address", key: "ipAddress" },
  { header: "Status", key: "status" },
  { header: "Meta CAPI", key: "capiStatus" },
  { header: "Created At", key: "createdAt" },
];

export async function GET(request: Request) {
  await verifyAdminSession();

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "csv";
  const dateRange = resolveLeadsDateRange(url.searchParams.get("range"));

  const { rows } = await getLeads({
    status: url.searchParams.get("status") ?? undefined,
    source: url.searchParams.get("source") ?? undefined,
    campaign: url.searchParams.get("campaign") ?? undefined,
    country: url.searchParams.get("country") ?? undefined,
    device: url.searchParams.get("device") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    from: dateRange?.from,
    to: dateRange?.to,
  });

  const exportRows = rows.map((row) => ({
    ...row,
    capiStatus: row.metaCapiSentAt ? "Sent" : row.metaCapiError ? "Failed" : "",
    createdAt: row.createdAt.toISOString(),
  }));

  if (format === "xlsx") {
    const buffer = await buildWorkbookBuffer("Leads", COLUMNS, exportRows);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="leads.xlsx"`,
      },
    });
  }

  const csv = toCsv(COLUMNS, exportRows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="leads.csv"`,
    },
  });
}
