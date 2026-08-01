"use server";

import { revalidatePath } from "next/cache";

import { verifyAdminSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { syncAllMetaAdAccounts } from "@/lib/meta/sync";

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
