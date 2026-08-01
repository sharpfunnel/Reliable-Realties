"use client";

import { useTransition } from "react";

import { updateLeadStatus } from "@/lib/admin/actions";
import { cn } from "@/lib/cn";

const STATUSES = ["new", "contacted", "qualified", "won", "lost"];

const STATUS_STYLES: Record<string, string> = {
  new: "border-blue-200 bg-blue-50 text-blue-700",
  contacted: "border-amber-200 bg-amber-50 text-amber-700",
  qualified: "border-purple-200 bg-purple-50 text-purple-700",
  won: "border-emerald-200 bg-emerald-50 text-emerald-700",
  lost: "border-slate-200 bg-slate-50 text-slate-500",
};

export function LeadStatusSelect({ leadId, status }: { leadId: string; status: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(() => {
          updateLeadStatus(leadId, next);
        });
      }}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium capitalize outline-none transition-opacity",
        STATUS_STYLES[status] ?? STATUS_STYLES.new,
        pending && "opacity-50",
      )}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
