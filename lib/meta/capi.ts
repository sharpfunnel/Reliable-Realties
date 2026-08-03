import "server-only";

import { prisma } from "@/lib/db";
import { buildLeadEventBody, eventsEndpoint, type LeadWithSession } from "@/lib/meta/capi-payload";

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
export async function sendLeadConversionEvent(lead: LeadWithSession) {
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

    const body = buildLeadEventBody(lead, accessToken);

    const res = await fetch(eventsEndpoint(pixelId), {
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
