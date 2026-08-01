import { NextResponse } from "next/server";

import { verifyAdminSession } from "@/lib/auth/dal";
import { getReportCampaigns, resolveReportRange } from "@/lib/admin/reports";
import { toCsv } from "@/lib/reports/csv";
import { buildWorkbookBuffer } from "@/lib/reports/excel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLUMNS = [
  { header: "Campaign", key: "name" },
  { header: "Status", key: "status" },
  { header: "Ad Account", key: "accountName" },
  { header: "Currency", key: "currency" },
  { header: "Spend", key: "spend" },
  { header: "Impressions", key: "impressions" },
  { header: "Clicks", key: "clicks" },
  { header: "Results", key: "results" },
  { header: "Cost / Result", key: "costPerResult" },
];

export async function GET(request: Request) {
  await verifyAdminSession();

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "csv";
  const range = resolveReportRange({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  const campaigns = await getReportCampaigns(range);

  if (format === "xlsx") {
    const buffer = await buildWorkbookBuffer("Campaigns", COLUMNS, campaigns);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="campaigns-report.xlsx"`,
      },
    });
  }

  const csv = toCsv(COLUMNS, campaigns);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="campaigns-report.csv"`,
    },
  });
}
