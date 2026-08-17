"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

import { site } from "@/lib/content";
import { track } from "@/lib/track/client/queue";

/**
 * Last-resort boundary for the whole app. Without this, an uncaught throw
 * from a third-party script (Meta Pixel, GTM, rrweb) — including the FB/IG
 * in-app browser's native JS bridge going away mid-session — blanks the
 * entire page instead of just failing quietly. Keeps a phone/WhatsApp
 * fallback visible so a lead already in progress isn't a dead end.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    try {
      track.error({
        type: "global_boundary",
        message: error.message?.slice(0, 500) || "Unknown error",
        stack: error.stack,
        path: window.location.pathname,
      });
      track.flushNow();
    } catch {
      // Reporting must never throw inside an error boundary.
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f7f4ed",
          color: "#1a1a1a",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Something went wrong.</h1>
        <p style={{ maxWidth: "28rem", opacity: 0.8 }}>
          Please try again, or reach us directly and we&apos;ll pick up from there.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={() => unstable_retry()}
            style={{
              padding: "0.6rem 1.2rem",
              borderRadius: "8px",
              border: "1px solid #1a1a1a",
              background: "#1a1a1a",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <a
            href={site.phoneHref}
            style={{
              padding: "0.6rem 1.2rem",
              borderRadius: "8px",
              border: "1px solid #1a1a1a",
              color: "#1a1a1a",
              textDecoration: "none",
            }}
          >
            Call {site.phone}
          </a>
          <a
            href={site.whatsappHref}
            style={{
              padding: "0.6rem 1.2rem",
              borderRadius: "8px",
              border: "1px solid #1a1a1a",
              color: "#1a1a1a",
              textDecoration: "none",
            }}
          >
            WhatsApp us
          </a>
        </div>
      </body>
    </html>
  );
}
