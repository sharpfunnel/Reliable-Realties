/**
 * Shared money formatting for the admin panel. Kept here rather than inline on a
 * page because spend now appears on the overview, the campaigns list, the
 * campaign detail view and the spend chart, and they must agree.
 *
 * `code` comes from `MetaAdAccount.currency` — INR is only the fallback for a
 * deployment with no connected account yet.
 */
export function formatCurrency(value: number, code = "INR", fractionDigits = 0) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: code,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** Axis-friendly short form: ₹1.2L / ₹34K. Full precision belongs in tooltips. */
export function formatCurrencyCompact(value: number, code = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: code,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
