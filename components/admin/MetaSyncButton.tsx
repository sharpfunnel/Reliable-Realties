"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";

import { triggerMetaSync } from "@/lib/meta/actions";
import { cn } from "@/lib/cn";

export function MetaSyncButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => triggerMetaSync())}
      className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-ink/90 disabled:opacity-60"
    >
      <RefreshCw className={cn("size-3.5", pending && "animate-spin")} strokeWidth={2} />
      {pending ? "Syncing…" : "Sync now"}
    </button>
  );
}
