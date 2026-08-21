"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { META_PIXEL_ID, trackPixelPageView } from "@/lib/meta/pixel";

/**
 * Meta Pixel — the browser half of the Meta integration. The server half is
 * `sendLeadConversionEvent` in lib/meta/capi.ts; both report into the same
 * dataset, identified by the pixel id.
 *
 * A client component rather than a plain <Script> because it has two jobs the
 * server can't do: skip /admin (the operator's own panel is not visitor
 * activity, matching what `Tracker` does), and fire PageView on client-side
 * navigation. The inline snippet only runs once per document, so without the
 * effect below every route after the first would go uncounted.
 *
 * Renders nothing until NEXT_PUBLIC_META_PIXEL_ID is set, so an unconfigured
 * environment ships no snippet at all.
 */
export function MetaPixel() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;
  const enabled = Boolean(META_PIXEL_ID) && !isAdmin;

  // The snippet fires the first PageView itself, so the effect must ignore the
  // pathname it mounted on and report only subsequent navigations.
  const initialPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (initialPathRef.current === null) {
      initialPathRef.current = pathname;
      return;
    }
    if (initialPathRef.current === pathname) return;
    try {
      trackPixelPageView();
    } catch {
      // Belt-and-braces: trackPixelPageView already guards its own fbq()
      // call, but this must never be the thing that throws during a route
      // change and blanks the page for a visitor mid-flow.
    }
  }, [enabled, pathname]);

  if (!enabled) return null;

  return (
    <>
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        // Verbatim Meta snippet — an `id` is required for Next.js to track and
        // de-duplicate inline scripts.
        dangerouslySetInnerHTML={{
          __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${META_PIXEL_ID}');fbq('trackSingle','${META_PIXEL_ID}','PageView');`,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          alt=""
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
