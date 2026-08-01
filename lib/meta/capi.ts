import "server-only";

import { createHash } from "node:crypto";

import { prisma } from "@/lib/db";
import type { Lead } from "@/generated/prisma/client";

function graphVersion() {
  return process.env.META_GRAPH_API_VERSION || "v21.0";
}

function sha256(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

async function resolveAccessToken(): Promise<string | null> {
  if (process.env.META_CAPI_ACCESS_TOKEN) {
    return process.env.META_CAPI_ACCESS_TOKEN;
  }
  const account = await prisma.metaAdAccount.findFirst({
    where: { accessToken: { not: null } },
    orderBy: { connectedAt: "desc" },
  });
  return account?.accessToken ?? null;
}

/**
 * Sends a server-side "Lead" event to Meta's Conversions API for a newly
 * created Lead row. A CAPI failure must never fail the lead submission
 * itself — callers should invoke this fire-and-forget.
 */
export async function sendLeadConversionEvent(lead: Lead & { session?: { fbclid: string | null; ipAddress: string | null } | null }) {
  const pixelId = process.env.META_PIXEL_ID;
  if (!pixelId) return;

  try {
    const accessToken = await resolveAccessToken();
    if (!accessToken) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { metaCapiError: "No Meta access token available (CAPI or connected ad account)." },
      });
      return;
    }

    const userData: Record<string, unknown> = {};
    if (lead.email) userData.em = [sha256(lead.email)];
    if (lead.phone) userData.ph = [sha256(lead.phone.replace(/[^0-9]/g, ""))];
    if (lead.session?.ipAddress) userData.client_ip_address = lead.session.ipAddress;
    if (lead.session?.fbclid) {
      userData.fbc = `fb.1.${Date.now()}.${lead.session.fbclid}`;
    }

    const body: Record<string, unknown> = {
      data: [
        {
          event_name: "Lead",
          event_time: Math.floor(lead.createdAt.getTime() / 1000),
          action_source: "website",
          event_id: lead.id,
          user_data: userData,
          custom_data: {
            value: 0,
            currency: "INR",
            lead_source: lead.source ?? undefined,
          },
        },
      ],
      access_token: accessToken,
    };
    if (process.env.META_CAPI_TEST_EVENT_CODE) {
      body.test_event_code = process.env.META_CAPI_TEST_EVENT_CODE;
    }

    const res = await fetch(`https://graph.facebook.com/${graphVersion()}/${pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      await prisma.lead.update({
        where: { id: lead.id },
        data: { metaCapiError: `HTTP ${res.status}: ${text.slice(0, 500)}` },
      });
      return;
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: { metaCapiSentAt: new Date(), metaCapiError: null },
    });
  } catch (error) {
    await prisma.lead
      .update({
        where: { id: lead.id },
        data: { metaCapiError: error instanceof Error ? error.message : "Unknown CAPI error" },
      })
      .catch(() => {});
  }
}
