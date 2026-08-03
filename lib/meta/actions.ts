"use server";

import { revalidatePath } from "next/cache";

import { verifyAdminSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { syncAllMetaAdAccounts } from "@/lib/meta/sync";
import { buildCapiPayload, type CapiPayloadPreview } from "@/lib/meta/capi-payload";
import { ACTION_SOURCES } from "@/lib/meta/capi-constants";

export async function triggerMetaSync() {
  await verifyAdminSession();
  await syncAllMetaAdAccounts();
  revalidatePath("/admin/campaigns");
}

export async function disconnectMetaAdAccount(accountId: string) {
  await verifyAdminSession();
  await prisma.metaAdAccount.update({
    where: { id: accountId },
    data: { accessToken: null, tokenExpiresAt: null },
  });
  revalidatePath("/admin/campaigns");
}

export type CapiPreviewState = {
  preview?: CapiPayloadPreview;
  error?: string;
};

function field(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Builds the Conversions API payload for the admin console and returns it for
 * display. This is a DRY RUN: it deliberately performs no network request, so
 * nothing reaches Meta and no ad delivery or attribution is affected.
 */
export async function previewCapiEvent(
  _prevState: CapiPreviewState,
  formData: FormData,
): Promise<CapiPreviewState> {
  await verifyAdminSession();

  const eventName = field(formData, "eventName");
  if (!eventName) return { error: "Event name is required." };

  const actionSource = field(formData, "actionSource") ?? "website";
  if (!(ACTION_SOURCES as readonly string[]).includes(actionSource)) {
    return { error: `Unsupported action_source: ${actionSource}` };
  }

  const rawEventTime = field(formData, "eventTime");
  let eventTime = Math.floor(Date.now() / 1000);
  if (rawEventTime) {
    const parsed = new Date(rawEventTime);
    if (Number.isNaN(parsed.getTime())) {
      return { error: "Event time is not a valid date." };
    }
    eventTime = Math.floor(parsed.getTime() / 1000);
  }

  const rawValue = field(formData, "value");
  let value: number | undefined;
  if (rawValue !== undefined) {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return { error: "Value must be a number." };
    value = parsed;
  }

  const preview = buildCapiPayload({
    eventName,
    actionSource,
    eventId: field(formData, "eventId") ?? "",
    eventTime,
    eventSourceUrl: field(formData, "eventSourceUrl"),
    user: {
      email: field(formData, "email"),
      phone: field(formData, "phone"),
      firstName: field(formData, "firstName"),
      lastName: field(formData, "lastName"),
      city: field(formData, "city"),
      state: field(formData, "state"),
      zip: field(formData, "zip"),
      country: field(formData, "country"),
      externalId: field(formData, "externalId"),
      clientIpAddress: field(formData, "clientIpAddress"),
      clientUserAgent: field(formData, "clientUserAgent"),
      fbc: field(formData, "fbc"),
      fbp: field(formData, "fbp"),
    },
    custom: {
      value,
      currency: field(formData, "currency"),
      contentName: field(formData, "contentName"),
      leadSource: field(formData, "leadSource"),
    },
    includeTestEventCode: formData.get("includeTestEventCode") === "on",
  });

  return { preview };
}
