"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import { primaryCta } from "@/lib/content";
import { Logo } from "@/components/ui/Logo";

/**
 * Floating pill navigation.
 *
 * Reduced to the brand lock-up and a single conversion CTA — the section
 * links live in the footer. The bar gains a stronger frosted background
 * once the page is scrolled.
 */
export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-5 pt-2.5 lg:px-10">
      <nav
        aria-label="Primary"
        className={cn(
          "mx-auto flex w-full max-w-[1280px] items-center justify-between gap-3",
          "rounded-[40px] py-2.5 pl-4 pr-3.5 backdrop-blur-[8px] sm:pl-6",
          "transition-[background-color,box-shadow] duration-500",
          scrolled
            ? "bg-white/65 shadow-[0_10px_40px_-24px_rgba(18,24,32,0.45)]"
            : "bg-white/40",
        )}
      >
        <Logo />

        <Link
          href={primaryCta.href}
          className="group inline-flex h-[46px] shrink-0 items-center gap-2 rounded-full bg-gold px-5 text-[15px] font-medium leading-none tracking-[0.013em] text-white transition-[background-color,transform] duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-0.5 hover:bg-gold/90 sm:px-7"
        >
          {/* Compact label on narrow viewports so the pill never crowds the logo */}
          <span className="sm:hidden">Enquire</span>
          <span className="hidden sm:inline">{primaryCta.label}</span>
          <ArrowUpRight
            aria-hidden
            className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            strokeWidth={2}
          />
        </Link>
      </nav>
    </header>
  );
}
