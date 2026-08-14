import { NextResponse } from "next/server";

import { syncAllMetaAdAccounts } from "@/lib/meta/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  // An unset CRON_SECRET must fail closed — this route triggers outbound Graph
  // API calls with a stored ad-account token, so it can't be left open just
  // because the deployment forgot to configure a secret.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not configured" }, { status: 401 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncAllMetaAdAccounts();
  return NextResponse.json({ ok: true, ...result });
}
