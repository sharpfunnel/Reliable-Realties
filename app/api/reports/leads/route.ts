import { NextResponse } from "next/server";

import { verifyAdminSession } from "@/lib/auth/dal";
import { getReportLeads, resolveReportRange } from "@/lib/admin/reports";
import { toCsv } from "@/lib/reports/csv";
import { buildWorkbookBuffer } from "@/lib/reports/excel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLUMNS = [
  { header: "Name", key: "name" },
  { header: "Phone", key: "phone" },
  { header: "Email", key: "email" },
  { header: "Budget", key: "budget" },
  { header: "Source", key: "source" },
  { header: "Status", key: "status" },
  { header: "Message", key: "message" },
  { header: "Created At", key: "createdAt" },
];

export async function GET(request: Request) {
  await verifyAdminSession();

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "csv";
  const range = resolveReportRange({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  const leads = await getReportLeads(range);
  const rows = leads.map((lead) => ({
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    budget: lead.budget,
    source: lead.source,
    status: lead.status,
    message: lead.message,
    createdAt: lead.createdAt.toISOString(),
  }));

  if (format === "xlsx") {
    const buffer = await buildWorkbookBuffer("Leads", COLUMNS, rows);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="leads-report.xlsx"`,
      },
    });
  }

  const csv = toCsv(COLUMNS, rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="leads-report.csv"`,
    },
  });
}
