/**
 * Minimal inline port of the `pg-format` helpers this package uses, so the
 * package carries no runtime dependency for them (the CommonJS-only
 * `pg-format` package is awkward to consume from ESM/bundled CLIs).
 *
 * Mirrors `pg-format@1.0.4` byte-for-byte for the inputs postgres-meta feeds
 * it — in particular numbers are quoted (`literal(10)` is `'10'`), because
 * that is what postgres-meta's SQL emits and this package is byte-parity
 * constrained against it. The `supabase/supabase` `packages/pg-meta` port
 * deliberately diverges here (unquoted numbers); do not "fix" this to match it.
 *
 * Originally ported from PostgreSQL's `src/interfaces/libpq/fe-exec.c`.
 */

/** Convert a JS ISO string to Postgres' default ISO 8601 form. */
function formatDate(date: string): string {
  return date.replace("T", " ").replace("Z", "+00");
}

function arrayToList(
  useSpace: boolean,
  array: unknown[],
  formatter: (value: unknown) => string,
): string {
  let sql = useSpace ? " (" : "(";
  for (const [index, element] of array.entries()) {
    sql += (index === 0 ? "" : ", ") + formatter(element);
  }
  sql += ")";
  return sql;
}

/**
 * Quote a value as a SQL literal. `null`/`undefined` become `NULL`, booleans
 * `'t'`/`'f'`, dates ISO 8601 strings, arrays comma-separated lists (nested
 * arrays become parenthesised groups), plain objects `'…'::jsonb`, and
 * everything else — including numbers — a single-quoted string with embedded
 * quotes doubled. Strings containing a backslash use the `E'…'` form.
 */
export function literal(value?: unknown): string {
  let text: string;
  let explicitCast: string | undefined;

  if (value === undefined || value === null) {
    return "NULL";
  }
  if (value === false) {
    return "'f'";
  }
  if (value === true) {
    return "'t'";
  }
  if (value instanceof Date) {
    return `'${formatDate(value.toISOString())}'`;
  }
  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const [index, element] of value.entries()) {
      if (Array.isArray(element)) {
        parts.push(arrayToList(index !== 0, element, literal));
      } else {
        parts.push(literal(element));
      }
    }
    return parts.toString();
  }
  if (typeof value === "string") {
    text = value;
  } else if (typeof value === "number" || typeof value === "bigint") {
    text = value.toString();
  } else {
    explicitCast = "jsonb";
    text = JSON.stringify(value);
  }

  let hasBackslash = false;
  let quoted = "'";

  for (const c of text) {
    if (c === "'") {
      quoted += c + c;
    } else if (c === "\\") {
      quoted += c + c;
      hasBackslash = true;
    } else {
      quoted += c;
    }
  }

  quoted += "'";

  if (hasBackslash) {
    quoted = `E${quoted}`;
  }

  if (explicitCast) {
    quoted += `::${explicitCast}`;
  }

  return quoted;
}
