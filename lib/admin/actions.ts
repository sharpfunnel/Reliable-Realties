"use server";

import { revalidatePath } from "next/cache";

import { verifyAdminSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";

const VALID_STATUSES = ["new", "contacted", "qualified", "won", "lost"];

export async function updateLeadStatus(leadId: string, status: string) {
  await verifyAdminSession();

  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid lead status: ${status}`);
  }

  await prisma.lead.update({ where: { id: leadId }, data: { status } });

  revalidatePath("/admin/leads");
  revalidatePath("/admin");
}
