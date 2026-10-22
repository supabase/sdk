import "@typespec/http";

using Http;

namespace PostgREST;

/** Vertical filtering. */
model SelectParameter {
  /**
   * Fields to return. On writes it shapes the representation returned with
   * `Prefer: return=representation`.
   */
  @query select?: SelectList;
}

/**
 * Horizontal filtering. Conditions in separate query parameters are combined
 * with AND.
 */
model FilterParameters {
  /**
   * Filters and embedded resource parameters. Each entry is one query
   * parameter. The key is one of:
   *
   * - `<field>`: a column, JSON/composite path (`json_data->>blood_type`) or
   *   computed field. The value is a `FilterExpression`, such as `age=gte.18`.
   *   Repeat the key to apply several conditions to the same field.
   * - `<embedded>`: an embedded resource from `select`. Only `is.null` and
   *   `not.is.null` are allowed, for example `actors=not.is.null`.
   * - `<embedded>.<field>`: a filter on an embedded resource, such as
   *   `actors.first_name=eq.Jehanne`. Nested embeddings chain with `.`:
   *   `roles.actors.first_name=like.*Tom*`.
   * - `<embedded>.order`, `<embedded>.limit`, `<embedded>.offset`: ordering
   *   and pagination of an embedded resource. The value is an `OrderList` or a
   *   `RowCount`.
   * - `<embedded>.or`, `<embedded>.and`, `<embedded>.not.or`,
   *   `<embedded>.not.and`: logical operators on an embedded resource. The
   *   value is a `LogicalExpression`.
   *
   * Filters on an embedded resource do not remove parent rows unless the
   * embedding uses `!inner` or the parent filters on `<embedded>=not.is.null`.
   */
  @query(#{ explode: true })
  filters?: Record<string>;

  /** At least one of the conditions holds. */
  @query or?: LogicalExpression;

  /** All conditions hold. */
  @query and?: LogicalExpression;

  /** Not all of the conditions hold. */
  @query("not.or") notOr?: LogicalExpression;

  /** Not all of the conditions hold. */
  @query("not.and") notAnd?: LogicalExpression;
}

/** Ordering and pagination. */
model PaginationParameters {
  /** Row order. */
  @query order?: OrderList;

  /** Maximum number of rows to return. The server caps it at `db-max-rows`. */
  @query limit?: RowCount;

  /** Number of rows to skip. */
  @query offset?: RowCount;
}

/** Explicit payload columns for writes. */
model ColumnsParameter {
  /**
   * Payload keys to write. Other keys in the payload are ignored. Keys missing
   * from a row get NULL, or the column DEFAULT with `Prefer: missing=default`.
   * An unknown column fails with PGRST204.
   */
  @query columns?: ColumnList;
}

/** Conflict target for upserts. */
model OnConflictParameter {
  /**
   * Columns of a UNIQUE constraint to use as the upsert conflict target,
   * instead of the primary key. Used with `Prefer: resolution=...`.
   */
  @query("on_conflict") onConflict?: ColumnList;
}
