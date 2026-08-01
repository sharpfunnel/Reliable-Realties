import { gzipSync } from "node:zlib";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const clientId = typeof body.clientId === "string" ? body.clientId : undefined;
  const events = Array.isArray(body.events) ? body.events : [];

  if (!clientId || events.length === 0) {
    return NextResponse.json({ ok: false, error: "clientId and events are required" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({ where: { clientId }, select: { id: true } });
  if (!session) {
    // /api/track hasn't created the Session row yet — client should retry shortly.
    return NextResponse.json({ ok: true, retry: true });
  }

  const compressed = gzipSync(Buffer.from(JSON.stringify(events)));

  await prisma.sessionReplay.create({
    data: {
      sessionId: session.id,
      data: compressed,
      eventCount: events.length,
    },
  });

  return NextResponse.json({ ok: true });
}
