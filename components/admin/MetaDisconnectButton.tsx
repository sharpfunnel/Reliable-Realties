"use client";

import { useTransition } from "react";

import { disconnectMetaAdAccount } from "@/lib/meta/actions";

export function MetaDisconnectButton({ accountId }: { accountId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => disconnectMetaAdAccount(accountId))}
      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
    >
      {pending ? "Disconnecting…" : "Disconnect"}
    </button>
  );
}
