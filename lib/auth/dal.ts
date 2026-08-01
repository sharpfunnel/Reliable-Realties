import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { getAdminSessionCookie, verifyAdminSessionToken } from "@/lib/auth/session";

export const verifyAdminSession = cache(async () => {
  const token = await getAdminSessionCookie();
  const isValid = await verifyAdminSessionToken(token);
  if (!isValid) {
    redirect("/admin/login");
  }
});
