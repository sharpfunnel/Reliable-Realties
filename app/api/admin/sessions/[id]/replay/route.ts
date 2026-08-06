import { gunzipSync } from "node:zlib";

import { NextResponse } from "next/server";

import { getAdminSessionCookie, verifyAdminSessionToken } from "@/lib/auth/session";
import { getSessionReplayChunks, getSessionTimeline } from "@/lib/admin/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getAdminSessionCookie();
  const isValid = await verifyAdminSessionToken(token);
  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [chunks, timeline] = await Promise.all([getSessionReplayChunks(id), getSessionTimeline(id)]);

  const events = chunks.flatMap((chunk) => {
    try {
      const json = gunzipSync(Buffer.from(chunk.data)).toString("utf-8");
      return JSON.parse(json) as unknown[];
    } catch {
      return [];
    }
  });

  return NextResponse.json({ events, timeline });
}
