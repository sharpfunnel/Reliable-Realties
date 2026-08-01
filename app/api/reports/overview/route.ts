import { NextResponse } from "next/server";

import { verifyAdminSession } from "@/lib/auth/dal";
import { getReportOverview, resolveReportRange } from "@/lib/admin/reports";
import { toCsv } from "@/lib/reports/csv";
import { buildWorkbookBuffer } from "@/lib/reports/excel";
import { buildSummaryPdf } from "@/lib/reports/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await verifyAdminSession();

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "csv";
  const range = resolveReportRange({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  const overview = await getReportOverview(range);
  const rangeLabel = `${range.from.toISOString().slice(0, 10)} to ${range.to.toISOString().slice(0, 10)}`;

  const stats = [
    { label: "Visitors", value: String(overview.visitors) },
    { label: "Sessions", value: String(overview.sessions) },
    { label: "Leads", value: String(overview.leads) },
    { label: "CTA Clicks", value: String(overview.ctaClicks) },
    { label: "Conversion Rate", value: `${overview.conversionRate.toFixed(2)}%` },
  ];

  if (format === "xlsx") {
    const buffer = await buildWorkbookBuffer(
      "Overview",
      [
        { header: "Metric", key: "label", width: 30 },
        { header: "Value", key: "value", width: 20 },
      ],
      stats,
    );
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="overview-report.xlsx"`,
      },
    });
  }

  if (format === "pdf") {
    const buffer = await buildSummaryPdf("Overview Report", rangeLabel, stats);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="overview-report.pdf"`,
      },
    });
  }

  const csv = toCsv(
    [
      { header: "Metric", key: "label" },
      { header: "Value", key: "value" },
    ],
    stats,
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="overview-report.csv"`,
    },
  });
}
