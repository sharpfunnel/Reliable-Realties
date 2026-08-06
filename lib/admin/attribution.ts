/**
 * Formatting helpers for the acquisition data captured on Session rows,
 * shared by the admin Sessions and Leads tables.
 */

export type RawParamsSummary = {
  /** Short cell label, e.g. "6 params". */
  preview: string;
  /** Full `key=value` list, one per line — meant for a title/tooltip. */
  full: string;
};

/**
 * `rawParams` is a Json column, so it arrives typed as unknown-ish. Returns
 * null when there's nothing worth showing, letting callers fall back to "—".
 */
export function formatRawParams(raw: unknown): RawParamsSummary | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length === 0) return null;

  return {
    preview: `${entries.length} param${entries.length === 1 ? "" : "s"}`,
    full: entries.map(([key, value]) => `${key}=${String(value)}`).join("\n"),
  };
}

/**
 * Ad platforms substitute their dynamic params already URL-encoded, so a Meta
 * `{{campaign.name}}` lands as `Reliable+Realties+%E2%80%93+Lead+Gen` — the
 * browser decodes the query string once, which only unwraps the outer layer
 * and leaves that escaped form in the column. Decode until the value stops
 * changing so the table reads the way the campaign does in Ads Manager.
 * Storage stays verbatim; this is a display-time fix, which also cleans up
 * every row captured before it.
 */
export function decodeTrackingValue(value: string | null | undefined): string | null {
  if (!value) return null;

  let current = value;
  // Two rounds cover the single- and double-encoded cases; the cap keeps a
  // pathological value from looping.
  for (let i = 0; i < 3; i += 1) {
    const spaced = current.replace(/\+/g, " ");
    let next: string;
    try {
      next = decodeURIComponent(spaced);
    } catch {
      // A value truncated mid-escape (Meta clips long ones) can't be decoded.
      // Keep the unambiguous `+` → space part rather than throwing it all away.
      return spaced;
    }
    if (next === current) break;
    current = next;
  }
  return current;
}

/** The click IDs, as a compact `google · meta` style list. */
export function formatClickIds(session: {
  gclid?: string | null;
  fbclid?: string | null;
  msclkid?: string | null;
}): string | null {
  const platforms = [
    session.gclid ? "google" : null,
    session.fbclid ? "meta" : null,
    session.msclkid ? "bing" : null,
  ].filter(Boolean);

  return platforms.length > 0 ? platforms.join(" · ") : null;
}

/** Hostname of a referrer URL, or "Direct" when there isn't one / it doesn't parse. */
export function referrerHost(referrer: string | null | undefined): string {
  if (!referrer) return "Direct";
  try {
    return new URL(referrer).hostname;
  } catch {
    return referrer;
  }
}

/**
 * A single, filterable "Traffic Source" label for a session — the UTM source
 * when one was captured, otherwise the referrer's hostname, otherwise "Direct".
 * Shared by the Sessions table and its filter dropdown so both agree on the
 * same bucketing.
 */
export function resolveTrafficSource(session: { utmSource?: string | null; referrer?: string | null }): string {
  return decodeTrackingValue(session.utmSource) || referrerHost(session.referrer);
}
