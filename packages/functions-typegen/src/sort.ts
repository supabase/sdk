/**
 * Canonical ordering pass for {@link EdgeFunctionsMetadata}. Generators emit
 * the collections in array order, so every collection is sorted by a semantic
 * key with the pinned collation: functions by slug, declarations by name,
 * diagnostics by function, path and message. Object properties, tuple
 * elements and union members keep their source order, which is meaningful
 * to the reader and already deterministic.
 */
import { compareStrings } from "./collation.ts";
import type { EdgeFunctionsMetadata } from "./types.ts";

/** Return a sorted copy of the document. Pure and idempotent. */
export function sortEdgeFunctionsMetadata(
  metadata: EdgeFunctionsMetadata,
): EdgeFunctionsMetadata {
  return {
    version: metadata.version,
    functions: [...metadata.functions]
      .sort((a, b) => compareStrings(a.slug, b.slug))
      .map((fn) => ({
        ...fn,
        types: [...fn.types].sort((a, b) => compareStrings(a.name, b.name)),
      })),
    diagnostics: [...metadata.diagnostics].sort(
      (a, b) =>
        compareStrings(a.slug, b.slug) ||
        compareStrings(a.path, b.path) ||
        compareStrings(a.message, b.message),
    ),
  };
}
