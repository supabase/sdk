namespace PostgREST;

/**
 * Name of a table, view or function in the exposed schema, as it appears in the
 * URL. Names are case sensitive. Percent-encode spaces and non-ASCII characters
 * (`Order%20Items`, `%D9%85%D9%88%D8%A7%D8%B1%D8%AF`).
 */
@minLength(1)
@example("people")
scalar ResourceName extends string;

/**
 * Vertical filtering: the comma-separated list of fields to return. Defaults to
 * `*` (all columns).
 *
 * Each item is one of:
 *
 * - a column or computed field: `first_name`, `*`
 * - a JSON, composite or array path with `->` (JSON) and `->>` (text):
 *   `json_data->phones->0->>number`
 * - an aliased item: `fullName:full_name`
 * - a cast item: `salary::text`
 * - an aggregate (when `db-aggregates-enabled`): `amount.sum()`, `amount.avg()::int`,
 *   `count()`. See `AggregateFunction`. Non-aggregated items become the GROUP BY.
 * - an embedded resource with its own select list:
 *   `directors(id,last_name)`, `director:directors(*)`, `directors()` (embed
 *   used only for filtering, not returned)
 * - an embedding hint to pick a foreign key, column or join table, and an
 *   optional join type: `addresses!billing(name)`, `actors!inner(*)`,
 *   `clients!client_id!left(*)`. See `EmbeddingJoinType`.
 * - a spread embedded resource whose fields are lifted into the parent object:
 *   `...directors(first_name)`. On a to-many relationship each field becomes an
 *   array.
 *
 * Wrap identifiers that contain reserved characters (`,` `.` `:` `*` `(` `)`)
 * in double quotes.
 */
@example("id,fullName:full_name,salary::text,director:directors!inner(id,last_name)")
scalar SelectList extends string;

/**
 * Comma-separated list of ordering terms. Each term is
 * `<field>[.asc|.desc][.nullsfirst|.nullslast]`, where `<field>` is a column, a
 * JSON/composite path (`location->>lat`) or, on a to-one embedded resource, an
 * embedded column (`directors(last_name)`). The default direction is ascending.
 */
@example("age.desc.nullslast,height")
scalar OrderList extends string;

/**
 * Comma-separated list of column names.
 */
@example("source,publication_date,figure")
scalar ColumnList extends string;

/**
 * Horizontal filter applied to a column, a JSON/composite path or a computed
 * field, sent as the value of the query parameter named after that field.
 *
 * Grammar: `[not.]<operator>[(<modifier>)].<value>`
 *
 * - `<operator>` is a `FilterOperator`.
 * - `<modifier>` is either an `OperatorModifier` (`like(any).{O*,P*}`) or, for
 *   the full-text search operators, a text search configuration
 *   (`fts(french).amusant`).
 * - `<value>` is the operand. `in` takes a parenthesized list
 *   (`in.(1,2,3)`), `cs`/`cd`/`ov` take array or range literals
 *   (`cs.{a,b}`, `ov.[2017-01-01,2017-06-30]`), `is` takes an `IsValue`. In
 *   `like` and `ilike` patterns `*` is an alias of `%`. Wrap values with
 *   reserved characters in double quotes and escape `"` and `\` with `\`.
 *
 * On an embedded resource name (for example `actors=not.is.null`) only
 * `is.null` and `not.is.null` are allowed.
 */
@example("not.in.(1,2,3)")
scalar FilterExpression extends string;

/**
 * Value of a logical operator query parameter (`or`, `and`, `not.or`,
 * `not.and`, and their embedded forms such as `actors.or`): a parenthesized,
 * comma-separated list of conditions.
 *
 * Each condition is either `<field>.<filter expression>` (for example
 * `age.lt.18`, `age.not.in.(1,2)`) or a nested logical operator
 * (`not.and(age.gte.11,age.lte.17)`). An embedded resource can be tested for
 * existence with `<embedded>.is.null` or `<embedded>.not.is.null`.
 */
@example("(age.eq.14,not.and(age.gte.11,age.lte.17))")
scalar LogicalExpression extends string;

/** Number of rows. */
@minValue(0)
scalar RowCount extends safeint;

/** Filter operators accepted in a `FilterExpression`. */
enum FilterOperator {
  /** `=` equals. */
  eq,

  /** `>` greater than. */
  gt,

  /** `>=` greater than or equal. */
  gte,

  /** `<` less than. */
  lt,

  /** `<=` less than or equal. */
  lte,

  /** `<>` not equal. */
  neq,

  /** `LIKE`. `*` is an alias of `%` in the pattern. */
  like,

  /** `ILIKE`. `*` is an alias of `%` in the pattern. */
  ilike,

  /** `~` POSIX regular expression match. */
  match,

  /** `~*` case-insensitive POSIX regular expression match. */
  imatch,

  /** `IN`: one of a parenthesized list of values, e.g. `in.(1,2,3)`. */
  in,

  /** `IS`: exact equality with an `IsValue`. */
  `is`,

  /** `IS DISTINCT FROM`: not equal, treating NULL as a comparable value. */
  isdistinct,

  /** `@@` full-text search using `to_tsquery`. */
  fts,

  /** `@@` full-text search using `plainto_tsquery`. */
  plfts,

  /** `@@` full-text search using `phraseto_tsquery`. */
  phfts,

  /** `@@` full-text search using `websearch_to_tsquery`. */
  wfts,

  /** `@>` contains, e.g. `cs.{example,new}`. */
  cs,

  /** `<@` contained in, e.g. `cd.{1,2,3}`. */
  cd,

  /** `&&` overlap, e.g. `ov.[2017-01-01,2017-06-30]` or `ov.{1,3}`. */
  ov,

  /** `<<` strictly left of, e.g. `sl.(1,10)`. */
  sl,

  /** `>>` strictly right of. */
  sr,

  /** `&<` does not extend to the right of. */
  nxr,

  /** `&>` does not extend to the left of. */
  nxl,

  /** `-|-` is adjacent to. */
  adj,
}

/**
 * Modifiers that apply an operator to every value in a list:
 * `last_name=like(any).{O*,P*}`. Valid on `eq`, `like`, `ilike`, `gt`, `gte`,
 * `lt`, `lte`, `match` and `imatch`.
 */
enum OperatorModifier {
  /** The comparison matches any value in the list (`= ANY`). */
  any,

  /** The comparison matches all values in the list (`= ALL`). */
  all,
}

/** Operands of the `is` operator. */
enum IsValue {
  null,
  not_null,
  `true`,
  `false`,
  `unknown`,
}

/** Logical operators, used as query parameter names. */
enum LogicalOperator {
  /** All conditions hold. */
  and,

  /** At least one condition holds. */
  or,
}

/** Sort directions in an `OrderList`. */
enum OrderDirection {
  asc,
  desc,
}

/** Placement of NULL values in an `OrderList`. */
enum NullsOrder {
  nullsfirst,
  nullslast,
}

/** Aggregate functions usable in a `SelectList` as `<field>.<function>()`. */
enum AggregateFunction {
  avg,
  count,
  max,
  min,
  sum,
}

/**
 * Join type hint for an embedded resource: `actors!inner(*)`. Without a hint,
 * embedding is a left join.
 */
enum EmbeddingJoinType {
  /** Only return parent rows that have at least one matching embedded row. */
  inner,

  /** Return every parent row. This is the default. */
  left,
}
