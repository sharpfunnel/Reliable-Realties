import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyAdminSession } from "@/lib/auth/dal";
import { buildOAuthDialogUrl } from "@/lib/meta/client";

export const runtime = "nodejs";

export async function GET() {
  await verifyAdminSession();

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("meta_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(buildOAuthDialogUrl(state));
}
