namespace PostgREST;

// RFC 7240 preferences. The `Prefer` header carries a comma-separated list of
// them. Each operation accepts only the preferences that affect it; the server
// ignores the others unless `handling=strict` is set (PGRST122).

/**
 * How the server treats invalid or unfulfillable preferences. `lenient` (the
 * default) ignores them. `strict` rejects the request with PGRST122.
 */
union HandlingPreference {
  lenient: "handling=lenient",
  strict: "handling=strict",
}

/**
 * Time zone for the transaction: any name in `pg_timezone_names` or a numeric
 * offset such as `05:30` or `-03:00`. An invalid time zone is always an error,
 * also with `handling=lenient`.
 */
@pattern("^timezone=.+$")
@example("timezone=America/Los_Angeles")
scalar TimezonePreference extends string;

/**
 * Whether the transaction ends in COMMIT or ROLLBACK. The server honors it only
 * when `db-tx-end` allows it.
 */
union TxPreference {
  commit: "tx=commit",
  rollback: "tx=rollback",
}

/**
 * Asks for the total number of rows, returned as the total in `Content-Range`.
 */
union CountPreference {
  /** Exact `count(*)`. Slow on large tables. */
  exact: "count=exact",

  /** Row estimate from the PostgreSQL planner statistics. */
  planned: "count=planned",

  /** Exact count up to `db-max-rows`, planned count above it. */
  estimated: "count=estimated",
}

/** What a write request returns. */
union ReturnPreference {
  /** No response body. This is the default. */
  minimal: "return=minimal",

  /** No body, plus a `Location` header for the created row. Needs a primary key. */
  headersOnly: "return=headers-only",

  /** The affected rows, shaped by `select`. */
  representation: "return=representation",
}

/** Upsert behavior on a primary key or `on_conflict` conflict. */
union ResolutionPreference {
  /** Update the conflicting row. */
  mergeDuplicates: "resolution=merge-duplicates",

  /** Keep the conflicting row and skip the new one. */
  ignoreDuplicates: "resolution=ignore-duplicates",
}

/**
 * Value for columns missing from the payload. The default is NULL. With
 * `missing=default` the column DEFAULT is used.
 */
union MissingPreference {
  useDefault: "missing=default",
}

/**
 * Upper bound for the number of rows a PATCH, DELETE or table-valued function
 * call can affect. Enforced only with `handling=strict`. Exceeding it fails
 * with PGRST124.
 */
@pattern("^max-affected=[0-9]+$")
@example("max-affected=10")
scalar MaxAffectedPreference extends string;

/** Preferences accepted by every request. */
union CommonPreference {
  HandlingPreference,
  TimezonePreference,
  TxPreference,
}

/** Preferences accepted by reads (GET and HEAD) on tables and views. */
union ReadPreference {
  CommonPreference,
  CountPreference,
}

/** Preferences accepted by POST on tables and views (insert and upsert). */
union InsertPreference {
  CommonPreference,
  CountPreference,
  ReturnPreference,
  ResolutionPreference,
  MissingPreference,
}

/** Preferences accepted by PUT on tables and views (single row upsert). */
union PutPreference {
  CommonPreference,
  ReturnPreference,
}

/** Preferences accepted by PATCH on tables and views. */
union UpdatePreference {
  CommonPreference,
  CountPreference,
  ReturnPreference,
  MissingPreference,
  MaxAffectedPreference,
}

/** Preferences accepted by DELETE on tables and views. */
union DeletePreference {
  CommonPreference,
  CountPreference,
  ReturnPreference,
  MaxAffectedPreference,
}

/** Preferences accepted by function calls. */
union FunctionPreference {
  CommonPreference,
  CountPreference,
  MaxAffectedPreference,
}
