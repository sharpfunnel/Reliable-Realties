"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import { logout } from "@/lib/auth/actions";
import { cn } from "@/lib/cn";

const TABS: { href: string; label: string; badge?: "leads" | "sessions" }[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/leads", label: "Leads", badge: "leads" },
  { href: "/admin/sessions", label: "Sessions", badge: "sessions" },
  { href: "/admin/heatmap", label: "Heatmap" },
  { href: "/admin/campaigns", label: "Campaigns" },
  { href: "/admin/meta-capi", label: "Meta CAPI" },
  { href: "/admin/funnels", label: "Funnels" },
  { href: "/admin/ctas", label: "CTAs" },
  { href: "/admin/forms", label: "Forms" },
  { href: "/admin/performance", label: "Performance" },
  { href: "/admin/errors", label: "Errors" },
  { href: "/admin/reports", label: "Reports" },
];

export function AdminNav({ counts }: { counts: { leads: number; sessions: number } }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-ink text-white">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-medium">Reliable Realties</span>
          <span className="hidden text-xs uppercase tracking-[0.2em] text-white/50 sm:inline">Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            target="_blank"
            className="text-xs text-white/70 transition-colors hover:text-white"
          >
            View site
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20"
            >
              <LogOut className="size-3.5" strokeWidth={2} />
              Logout
            </button>
          </form>
        </div>
      </div>
      <nav className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-4 pb-2 sm:px-6 lg:px-8">
        {TABS.map((tab) => {
          const active = tab.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(tab.href);
          const badgeValue = tab.badge ? counts[tab.badge] : undefined;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active ? "bg-gold text-white" : "text-white/60 hover:bg-white/10 hover:text-white",
              )}
            >
              {tab.label}
              {badgeValue ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    active ? "bg-white/25" : "bg-white/10",
                  )}
                >
                  {badgeValue}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
