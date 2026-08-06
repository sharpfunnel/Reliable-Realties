import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { findOrCreateSession, sanitizeRawParams, upsertVisitor } from "@/lib/track/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toDate(value: unknown): Date {
  const n = typeof value === "number" ? value : Date.parse(String(value));
  return Number.isFinite(n) ? new Date(n) : new Date();
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const fingerprint = str(body.fingerprint);
  const clientId = str(body.clientId);
  if (!fingerprint || !clientId) {
    return NextResponse.json({ ok: false, error: "fingerprint and clientId are required" }, { status: 400 });
  }

  const device = (body.device ?? {}) as Record<string, unknown>;
  const sessionInit = (body.sessionInit ?? {}) as Record<string, unknown>;

  const visitor = await upsertVisitor(request, fingerprint, {
    screenWidth: num(device.screenWidth),
    screenHeight: num(device.screenHeight),
    language: str(device.language),
    timezone: str(device.timezone),
    browser: str(device.browser),
    browserVersion: str(device.browserVersion),
    os: str(device.os),
    osVersion: str(device.osVersion),
    deviceType: str(device.deviceType),
    network: str(device.network),
    downlink: num(device.downlink),
  });

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
    viewportWidth: num(sessionInit.viewportWidth),
    viewportHeight: num(sessionInit.viewportHeight),
  });

  const sessionId = session.id;

  const pageViews = Array.isArray(body.pageViews) ? (body.pageViews as Record<string, unknown>[]) : [];
  const events = Array.isArray(body.events) ? (body.events as Record<string, unknown>[]) : [];
  const scrollEvents = Array.isArray(body.scrollEvents) ? (body.scrollEvents as Record<string, unknown>[]) : [];
  const ctaEvents = Array.isArray(body.ctaEvents) ? (body.ctaEvents as Record<string, unknown>[]) : [];
  const formEvents = Array.isArray(body.formEvents) ? (body.formEvents as Record<string, unknown>[]) : [];
  const perfMetrics = Array.isArray(body.perfMetrics) ? (body.perfMetrics as Record<string, unknown>[]) : [];
  const errors = Array.isArray(body.errors) ? (body.errors as Record<string, unknown>[]) : [];
  const mouseEvents = Array.isArray(body.mouseEvents) ? (body.mouseEvents as Record<string, unknown>[]) : [];
  const heatmapEvents = Array.isArray(body.heatmapEvents) ? (body.heatmapEvents as Record<string, unknown>[]) : [];

  await Promise.all([
    pageViews.length
      ? prisma.pageView.createMany({
          data: pageViews.map((p) => ({
            sessionId,
            path: String(p.path ?? "/"),
            title: str(p.title),
            enteredAt: toDate(p.enteredAt),
            exitedAt: p.exitedAt ? toDate(p.exitedAt) : undefined,
            timeOnPage: num(p.timeOnPage),
          })),
        })
      : Promise.resolve(),
    events.length
      ? prisma.event.createMany({
          data: events.map((e) => ({
            sessionId,
            name: String(e.name ?? "event"),
            metadata: e.metadata ?? undefined,
            createdAt: toDate(e.createdAt),
          })),
        })
      : Promise.resolve(),
    scrollEvents.length
      ? prisma.scrollEvent.createMany({
          data: scrollEvents.map((e) => ({
            sessionId,
            path: String(e.path ?? "/"),
            depth: num(e.depth) ?? 0,
            timeToReach: num(e.timeToReach),
            createdAt: toDate(e.createdAt),
          })),
        })
      : Promise.resolve(),
    ctaEvents.length
      ? prisma.ctaEvent.createMany({
          data: ctaEvents.map((e) => ({
            sessionId,
            ctaId: String(e.ctaId ?? "unknown"),
            action: String(e.action ?? "viewed"),
            timeBeforeClick: num(e.timeBeforeClick),
            createdAt: toDate(e.createdAt),
          })),
        })
      : Promise.resolve(),
    formEvents.length
      ? prisma.formEvent.createMany({
          data: formEvents.map((e) => ({
            sessionId,
            formId: String(e.formId ?? "unknown"),
            action: String(e.action ?? "viewed"),
            fieldName: str(e.fieldName),
            errorMessage: str(e.errorMessage),
            createdAt: toDate(e.createdAt),
          })),
        })
      : Promise.resolve(),
    perfMetrics.length
      ? prisma.performanceMetric.createMany({
          data: perfMetrics.map((e) => ({
            sessionId,
            path: String(e.path ?? "/"),
            metric: String(e.metric ?? "LCP"),
            value: num(e.value) ?? 0,
            rating: String(e.rating ?? "good"),
            createdAt: toDate(e.createdAt),
          })),
        })
      : Promise.resolve(),
    errors.length
      ? prisma.errorEvent.createMany({
          data: errors.map((e) => ({
            sessionId,
            type: String(e.type ?? "js"),
            message: String(e.message ?? "").slice(0, 2000),
            stack: str(e.stack)?.slice(0, 4000),
            path: str(e.path),
            createdAt: toDate(e.createdAt),
          })),
        })
      : Promise.resolve(),
    mouseEvents.length
      ? prisma.mouseEvent.createMany({
          data: mouseEvents.map((e) => ({
            sessionId,
            path: String(e.path ?? "/"),
            type: String(e.type ?? "rage_click"),
            x: num(e.x) ?? 0,
            y: num(e.y) ?? 0,
            targetSelector: str(e.targetSelector),
            hoverDuration: num(e.hoverDuration),
            createdAt: toDate(e.createdAt),
          })),
        })
      : Promise.resolve(),
    heatmapEvents.length
      ? prisma.heatmapEvent.createMany({
          data: heatmapEvents.map((e) => ({
            sessionId,
            path: String(e.path ?? "/"),
            type: String(e.type ?? "click"),
            xPct: num(e.xPct) ?? 0,
            yPct: num(e.yPct) ?? 0,
            viewportWidth: num(e.viewportWidth),
            selector: str(e.selector)?.slice(0, 200),
            text: str(e.text)?.slice(0, 200),
            createdAt: toDate(e.createdAt),
          })),
        })
      : Promise.resolve(),
  ]);

  const hasEngagementSignal =
    scrollEvents.length > 0 || ctaEvents.length > 0 || formEvents.length > 0 || events.length > 0;

  const pagesViewedIncrement = pageViews.length;
  const nextPagesViewed = session.pagesViewed + pagesViewedIncrement;
  const now = new Date();
  const elapsedSeconds = (now.getTime() - session.startedAt.getTime()) / 1000;
  const isBounce = !(nextPagesViewed > 1 || elapsedSeconds >= 10 || hasEngagementSignal);
  const endSession = body.endSession === true;
  const exitPath = str(body.exitPath);

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      pagesViewed: nextPagesViewed,
      isBounce,
      exitPath: exitPath ?? session.exitPath ?? undefined,
      endedAt: endSession ? now : undefined,
      totalDuration: endSession ? Math.round(elapsedSeconds) : undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
