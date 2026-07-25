import { cn } from "@/lib/cn";

/**
 * Reliable Realties brand mark — a line-art monogram built from two nested
 * diamonds and a stylised roofline, drawn in the brand gold.
 *
 * Delivered as inline SVG so it scales crisply, inherits `currentColor`
 * and costs no network request. Replace with the client's supplied logo
 * (PNG/SVG) when it is available.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={cn("text-gold", className)}
    >
      {/* Outer diamond */}
      <path
        d="M24 2.5 45.5 24 24 45.5 2.5 24 24 2.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {/* Inner diamond */}
      <path
        d="M24 10.5 37.5 24 24 37.5 10.5 24 24 10.5Z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
        opacity="0.55"
      />
      {/* Roofline + column, echoing a building elevation */}
      <path
        d="M16.5 27.5 24 20l7.5 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24 20v10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Cardinal ticks */}
      <path
        d="M24 2.5v4M24 41.5v4M2.5 24h4M41.5 24h4"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}
