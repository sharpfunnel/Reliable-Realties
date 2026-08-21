import Script from "next/script";

/**
 * Google Tag Manager container.
 *
 * GTM ships as two co-dependent pieces, so they live together here:
 *  - `GoogleTagManagerScript` — the loader, rendered in the root layout.
 *  - `GoogleTagManagerNoScript` — the iframe fallback, which must be the
 *    first element inside <body>.
 *
 * The loader uses the `afterInteractive` strategy (next/script's default):
 * it is fetched early but after hydration begins, so tag loading never blocks
 * first paint. This is the same trade-off `@next/third-parties` makes.
 */

/** Container ID. Override per environment with NEXT_PUBLIC_GTM_ID if needed. */
export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? "GTM-MV59B2B3";

export function GoogleTagManagerScript() {
  return (
    <Script
      id="google-tag-manager"
      strategy="afterInteractive"
      // Verbatim GTM container snippet — an `id` is required for Next.js to
      // track and de-duplicate inline scripts.
      dangerouslySetInnerHTML={{
        __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`,
      }}
    />
  );
}

export function GoogleTagManagerNoScript() {
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        title="Google Tag Manager"
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
      />
    </noscript>
  );
}
