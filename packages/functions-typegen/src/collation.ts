/**
 * The one string comparison every ordering in this package uses.
 *
 * Generated output is ordered by name, and `String.prototype.localeCompare`
 * without a locale follows the host's default locale, so the same database
 * produced differently ordered code on differently configured machines (a
 * Swedish host sorts `ä` after `z`, an English one next to `a`). Pinning the
 * collator to English keeps the order postgres-meta's output has on the
 * English CI runners and makes it the same everywhere else.
 */
const collator = new Intl.Collator("en");

/** Compare two strings with the pinned English collation. */
export function compareStrings(a: string, b: string): number {
  return collator.compare(a, b);
}
