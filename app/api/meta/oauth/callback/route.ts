import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyAdminSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { exchangeCodeForToken, listAdAccounts } from "@/lib/meta/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  await verifyAdminSession();

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("meta_oauth_state")?.value;
  cookieStore.delete("meta_oauth_state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/admin/campaigns?meta_error=invalid_state", url.origin));
  }

  try {
    const { accessToken, expiresInSeconds } = await exchangeCodeForToken(code);
    const accounts = await listAdAccounts(accessToken);
    const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    await Promise.all(
      accounts.map((account) =>
        prisma.metaAdAccount.upsert({
          where: { accountId: account.id },
          create: {
            accountId: account.id,
            name: account.name,
            currency: account.currency,
            timezoneName: account.timezone_name,
            accessToken,
            tokenExpiresAt,
          },
          update: {
            name: account.name,
            currency: account.currency,
            timezoneName: account.timezone_name,
            accessToken,
            tokenExpiresAt,
            lastSyncError: null,
          },
        }),
      ),
    );

    return NextResponse.redirect(new URL("/admin/campaigns", url.origin));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.redirect(
      new URL(`/admin/campaigns?meta_error=${encodeURIComponent(message)}`, url.origin),
    );
  }
}
