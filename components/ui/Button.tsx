import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/cn";

type Variant = "dark" | "outline" | "gold";
type IconKind = "up-right" | "right" | "none";

const VARIANTS: Record<Variant, string> = {
  dark: "bg-ink text-white hover:bg-ink/90",
  outline:
    "bg-white/40 text-forest ring-1 ring-inset ring-gold/25 hover:bg-white/70",
  gold: "bg-gold text-white hover:bg-gold/90",
};

const BASE =
  "group inline-flex h-[46px] items-center justify-center gap-2 rounded-full px-7 " +
  "text-[15px] font-medium leading-none tracking-[0.013em] backdrop-blur-[9px] " +
  "transition-[background-color,transform,box-shadow] duration-300 ease-[var(--ease-out-soft)] " +
  "hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap";

function Icon({ kind }: { kind: IconKind }) {
  if (kind === "none") return null;
  const shared =
    "size-4 shrink-0 transition-transform duration-300 ease-[var(--ease-out-soft)]";
  return kind === "up-right" ? (
    <ArrowUpRight
      aria-hidden
      className={cn(shared, "group-hover:translate-x-0.5 group-hover:-translate-y-0.5")}
      strokeWidth={2}
    />
  ) : (
    <ArrowRight
      aria-hidden
      className={cn(shared, "group-hover:translate-x-1")}
      strokeWidth={2}
    />
  );
}

type ButtonLinkProps = {
  href: string;
  children: ReactNode;
  variant?: Variant;
  icon?: IconKind;
  className?: string;
  "data-cta-id"?: string;
};

/** Anchor-styled CTA — used for every navigational button on the page. */
export function ButtonLink({
  href,
  children,
  variant = "dark",
  icon = "up-right",
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link href={href} className={cn(BASE, VARIANTS[variant], className)} {...props}>
      {children}
      <Icon kind={icon} />
    </Link>
  );
}

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: Variant;
  icon?: IconKind;
};

/** Native button variant — used by the contact form. */
export function Button({
  children,
  variant = "dark",
  icon = "up-right",
  className,
  ...props
}: ButtonProps) {
  return (
    <button className={cn(BASE, VARIANTS[variant], className)} {...props}>
      {children}
      <Icon kind={icon} />
    </button>
  );
}
