"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";

import { resendLeadCapiEvent } from "@/lib/admin/actions";
import { cn } from "@/lib/cn";

export function ResendCapiButton({ leadId }: { leadId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => resendLeadCapiEvent(leadId))}
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
      title="Resend Meta Conversions API event"
    >
      <RefreshCw className={cn("size-3", pending && "animate-spin")} strokeWidth={2} />
      Resend
    </button>
  );
}
