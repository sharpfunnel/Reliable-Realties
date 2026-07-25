import Link from "next/link";

import { cn } from "@/lib/cn";
import { site } from "@/lib/content";
import { LogoMark } from "./LogoMark";

/**
 * Wordmark lock-up: brand mark + serif wordmark with the tagline beneath.
 * `size` switches between the navbar and footer proportions.
 */
export function Logo({
  size = "sm",
  className,
}: {
  size?: "sm" | "lg";
  className?: string;
}) {
  const large = size === "lg";

  return (
    <Link
      href="#top"
      aria-label={`${site.name} — ${site.tagline}`}
      className={cn(
        "group flex shrink-0 items-center",
        large ? "gap-3" : "gap-2.5",
        className,
      )}
    >
      <LogoMark
        className={cn(
          "shrink-0 transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:rotate-90",
          large ? "size-[54px]" : "size-9 sm:size-[42px]",
        )}
      />
      <span className="flex flex-col">
        <span
          className={cn(
            "font-display font-normal uppercase leading-[0.9] tracking-[-0.012em] text-ink",
            large ? "text-[34px]" : "text-[17px] sm:text-[21px]",
          )}
        >
          {site.name}
        </span>
        <span
          className={cn(
            "font-normal uppercase leading-[1.15] tracking-[0.14em] text-gold",
            large ? "mt-1 text-[11px]" : "text-[8px] sm:text-[9px]",
          )}
        >
          {site.tagline}
        </span>
      </span>
    </Link>
  );
}
