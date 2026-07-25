/** Tiny classname joiner — keeps conditional Tailwind lists readable. */
export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}
