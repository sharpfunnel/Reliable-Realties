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
  return session.utmSource || referrerHost(session.referrer);
}
