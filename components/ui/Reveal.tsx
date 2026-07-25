"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

import { cn } from "@/lib/cn";

type RevealProps = {
  children: ReactNode;
  /** Element to render. Defaults to a plain div. */
  as?: ElementType;
  className?: string;
  /** Stagger in milliseconds before the animation starts. */
  delay?: number;
  /** Vertical travel distance in pixels. */
  y?: number;
  /** Entry blur in pixels — the reference blurs content in as it settles. */
  blur?: number;
  id?: string;
};

/**
 * Scroll-triggered entrance animation.
 *
 * Uses a single IntersectionObserver per instance and unobserves after the
 * first reveal, so nothing is animated twice and no scroll listeners are kept
 * alive. All motion is expressed in CSS (see `[data-reveal]` in globals.css)
 * which keeps the JS payload near-zero and honours `prefers-reduced-motion`.
 */
export function Reveal({
  children,
  as: Tag = "div",
  className,
  delay = 0,
  y = 28,
  blur = 6,
  id,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Already in view on first paint (above the fold) — reveal immediately.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.setAttribute("data-reveal", "in");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      id={id}
      data-reveal=""
      className={cn(className)}
      style={
        {
          "--reveal-delay": `${delay}ms`,
          "--reveal-y": `${y}px`,
          "--reveal-blur": `${blur}px`,
        } as React.CSSProperties
      }
    >
      {children}
    </Tag>
  );
}
