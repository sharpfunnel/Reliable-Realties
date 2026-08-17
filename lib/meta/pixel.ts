/**
 * Browser-side Meta Pixel helpers.
 *
 * The snippet in `components/analytics/MetaPixel.tsx` defines `window.fbq` as a
 * stub that queues calls until `fbevents.js` finishes loading, so anything here
 * is safe to call the moment the snippet has run. Before that — and on /admin,
 * where the pixel is never mounted — `fbq` is undefined, hence the guards.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

/**
 * Every call here uses `trackSingle` rather than `track`, which addresses a
 * multi-pixel hazard: `fbq("track", ...)` broadcasts to *every* pixel
 * initialized on the page, and the GTM container (GTM-MV59B2B3) initializes a
 * second one, 1745759740069524. Plain `track` would silently write this site's
 * conversions into that other dataset too. `trackSingle` pins each call to our
 * pixel.
 *
 * Note this only controls events leaving *our* code. GTM's own tags still
 * broadcast into our dataset; that has to be fixed in the container.
 */
export function trackPixelPageView() {
  if (!META_PIXEL_ID) return;
  try {
    window.fbq?.("trackSingle", META_PIXEL_ID, "PageView");
  } catch {
    // fbq is Meta's own script — e.g. the FB/IG in-app browser's native JS
    // bridge can go away mid-session and make any call into it throw. A
    // tracking failure here must never take down the page.
  }
}

/**
 * Fires the browser half of a Lead conversion.
 *
 * `eventId` must be the Lead row's database id — the same value the server
 * sender puts in `event_id` (see `buildLeadEventBody` in lib/meta/capi-payload.ts).
 * Meta collapses the two into one conversion when the pair matches; if they
 * ever diverge, every lead gets counted twice.
 */
export function trackPixelLead(eventId: string) {
  if (!META_PIXEL_ID) return;
  try {
    window.fbq?.("trackSingle", META_PIXEL_ID, "Lead", {}, { eventID: eventId });
  } catch {
    // Same rationale as trackPixelPageView — the lead is already saved
    // server-side by this point, so a pixel throw must not surface as a
    // submission failure.
  }
}
