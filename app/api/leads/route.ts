import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";

import { prisma } from "@/lib/db";
import { findOrCreateSession, sanitizeRawParams, upsertVisitor } from "@/lib/track/ingest";
import { sendLeadConversionEvent } from "@/lib/meta/capi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const name = str(body.name);
  const phone = str(body.phone);
  const email = str(body.email);

  if (!name || (!phone && !email)) {
    return NextResponse.json(
      { ok: false, error: "name and at least one of phone/email are required" },
      { status: 400 },
    );
  }

  const fingerprint = str(body.fingerprint);
  const clientId = str(body.clientId);
  const device = (body.device ?? {}) as Record<string, unknown>;
  const sessionInit = (body.sessionInit ?? {}) as Record<string, unknown>;

  let visitorId: string | undefined;
  let sessionId: string | undefined;

  if (fingerprint) {
    const visitor = await upsertVisitor(request, fingerprint, {
      screenWidth: typeof device.screenWidth === "number" ? device.screenWidth : undefined,
      screenHeight: typeof device.screenHeight === "number" ? device.screenHeight : undefined,
      language: str(device.language),
      timezone: str(device.timezone),
      browser: str(device.browser),
      browserVersion: str(device.browserVersion),
      os: str(device.os),
      deviceType: str(device.deviceType),
    });
    visitorId = visitor.id;

    if (clientId) {
      const session = await findOrCreateSession(request, clientId, visitor.id, {
        entryPath: str(sessionInit.entryPath),
        referrer: str(sessionInit.referrer),
        utmSource: str(sessionInit.utmSource),
        utmMedium: str(sessionInit.utmMedium),
        utmCampaign: str(sessionInit.utmCampaign),
        utmContent: str(sessionInit.utmContent),
        utmTerm: str(sessionInit.utmTerm),
        gclid: str(sessionInit.gclid),
        fbclid: str(sessionInit.fbclid),
        msclkid: str(sessionInit.msclkid),
        placement: str(sessionInit.placement),
        metaCampaignId: str(sessionInit.metaCampaignId),
        metaAdsetId: str(sessionInit.metaAdsetId),
        metaAdId: str(sessionInit.metaAdId),
        rawParams: sanitizeRawParams(sessionInit.rawParams),
        viewportWidth: typeof sessionInit.viewportWidth === "number" ? sessionInit.viewportWidth : undefined,
        viewportHeight: typeof sessionInit.viewportHeight === "number" ? sessionInit.viewportHeight : undefined,
      });
      sessionId = session.id;
    }
  }

  const lead = await prisma.lead.create({
    data: {
      visitorId,
      sessionId,
      formId: str(body.formId) ?? "contact-enquiry",
      name,
      phone,
      email,
      budget: str(body.budget),
      message: str(body.message),
      source: str(body.source) ?? str(sessionInit.utmSource) ?? "website",
    },
    include: {
      session: { select: { fbclid: true, ipAddress: true } },
    },
  });

  waitUntil(sendLeadConversionEvent(lead));

  return NextResponse.json({ ok: true, leadId: lead.id });
}

/**
 * Fills in the optional details (email, budget, message) a visitor adds on
 * the thank-you page after already submitting the required name + phone.
 */
export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const leadId = str(body.leadId);
  if (!leadId) {
    return NextResponse.json({ ok: false, error: "leadId is required" }, { status: 400 });
  }

  const email = str(body.email);
  const budget = str(body.budget);
  const message = str(body.message);

  if (!email && !budget && !message) {
    return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
  }

  try {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        ...(email ? { email } : {}),
        ...(budget ? { budget } : {}),
        ...(message ? { message } : {}),
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
