import Link from "next/link";

import { PageHeader } from "@/components/admin/PageHeader";
import { ConversionFunnel } from "@/components/admin/ConversionFunnel";
import { cn } from "@/lib/cn";
import { getFunnelStats } from "@/lib/admin/queries";

export default async function AdminFunnelsPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const { source: rawSource = "all" } = await searchParams;
  const source = rawSource === "meta" ? "meta" : "all";
  const funnel = await getFunnelStats(30, source);

  return (
    <>
      <PageHeader title="Funnels" description="Page view → scroll → CTA → form start → lead, last 30 days" />

      <div className="mb-5 flex gap-1.5">
        {(["all", "meta"] as const).map((value) => (
          <Link
            key={value}
            href={value === "all" ? "/admin/funnels" : "/admin/funnels?source=meta"}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              source === value ? "bg-ink text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            )}
          >
            {value === "all" ? "All traffic" : "Meta ads only"}
          </Link>
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <ConversionFunnel stages={funnel.stages} />
      </section>
    </>
  );
}
