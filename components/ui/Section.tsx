import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Reveal } from "./Reveal";

/**
 * Page section shell: 60px vertical rhythm, fluid gutters and a 1200px
 * content column — matching the reference layout grid exactly.
 */
export function Section({
  id,
  children,
  className,
  containerClassName,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  containerClassName?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24 px-5 py-15 lg:px-10", className)}>
      <div className={cn("mx-auto w-full max-w-[1200px]", containerClassName)}>
        {children}
      </div>
    </section>
  );
}

/** Small uppercase gold label with the leading rule, e.g. "— AMENITIES". */
export function Eyebrow({
  children,
  className,
  withRule = true,
}: {
  children: ReactNode;
  className?: string;
  withRule?: boolean;
}) {
  return (
    <p className={cn("eyebrow flex items-center gap-3", className)}>
      {withRule ? (
        <span aria-hidden className="h-px w-7 bg-gold" />
      ) : null}
      {children}
    </p>
  );
}

/**
 * Section heading block — eyebrow, display heading and optional lead copy.
 * `align` switches between the left-aligned and centred layouts used
 * across the page.
 */
export function SectionHeader({
  eyebrow,
  title,
  body,
  align = "left",
  headingClassName = "display-lg",
  className,
  bodyClassName,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  body?: string;
  align?: "left" | "center";
  headingClassName?: string;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        "flex flex-col gap-6",
        centered && "items-center text-center",
        className,
      )}
    >
      <Reveal y={20} blur={4}>
        <Eyebrow withRule={!centered} className={centered ? "justify-center" : undefined}>
          {eyebrow}
        </Eyebrow>
      </Reveal>

      <Reveal delay={80}>
        <h2 className={cn(headingClassName, "text-ink")}>{title}</h2>
      </Reveal>

      {body ? (
        <Reveal delay={160}>
          <p
            className={cn(
              "body-base text-ink",
              centered ? "mx-auto max-w-[500px]" : "max-w-[490px]",
              bodyClassName,
            )}
          >
            {body}
          </p>
        </Reveal>
      ) : null}

      {children}
    </div>
  );
}
