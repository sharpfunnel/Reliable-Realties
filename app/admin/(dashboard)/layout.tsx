import type { ReactNode } from "react";

import { verifyAdminSession } from "@/lib/auth/dal";
import { AdminNav } from "@/components/admin/AdminNav";
import { getNavCounts } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export default async function AdminDashboardLayout({ children }: { children: ReactNode }) {
  await verifyAdminSession();
  const counts = await getNavCounts();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AdminNav counts={counts} />
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
