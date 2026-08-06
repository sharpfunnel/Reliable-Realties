import { NextResponse } from "next/server";

import { getAdminSessionCookie, verifyAdminSessionToken } from "@/lib/auth/session";
import { getLiveVisitorCount } from "@/lib/admin/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const token = await getAdminSessionCookie();
  const isValid = await verifyAdminSessionToken(token);
  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await getLiveVisitorCount();
  return NextResponse.json({ count });
}
