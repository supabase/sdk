import "@typespec/http";

using Http;

namespace PostgREST;

/**
 * Item range for pagination, as `<first>-<last>` or the open-ended
 * `<first>-`. Indexes are zero-based and inclusive.
 */
@pattern("^[0-9]+-[0-9]*$")
@example("0-19")
scalar ItemRange extends string;

/**
 * Range of the returned rows and, when a count was requested, the total:
 * `<first>-<last>/<total>`. The range is `*` when no rows were returned, and
 * the total is `*` when no count was requested.
 */
@pattern("^(\\*|[0-9]+-[0-9]+)/(\\*|[0-9]+)$")
@example("0-24/3573458")
scalar ContentRange extends string;

/** Request header `Prefer` (RFC 7240), as a comma-separated list. */
model PreferHeader<Preference> {
  /** Preferences for this request. */
  @header("Prefer") prefer?: Preference[];
}

/** Schema selection for reads. */
alias AcceptProfileHeader = {
  /**
   * Schema to read from, when the server exposes several schemas
   * (`db-schemas`). Defaults to the first schema. An unknown schema fails with
   * PGRST106.
   */
  @header("Accept-Profile") acceptProfile?: string;
};

/** Schema selection for writes and function calls with POST. */
alias ContentProfileHeader = {
  /**
   * Schema to write to or call into, when the server exposes several schemas
   * (`db-schemas`). Defaults to the first schema. An unknown schema fails with
   * PGRST106.
   */
  @header("Content-Profile") contentProfile?: string;
};

/**
 * Pagination with HTTP range headers, an alternative to the `limit` and
 * `offset` query parameters. An invalid range fails with PGRST103 (416).
 */
alias RangeRequestHeaders = {
  /**
   * Rows to return. An alternative to the `limit` and `offset` query
   * parameters. An invalid range fails with PGRST103 (416).
   */
  @header("Range") range?: ItemRange;

  /** Unit of `Range`. Only `items` is supported. */
  @header("Range-Unit") rangeUnit?: "items";
};

/** Headers that PostgREST sets on every successful response. */
alias CommonResponseHeaders = {
  /** Preferences from the `Prefer` header that the server applied. */
  @header("Preference-Applied") preferenceApplied?: string;
};

/** Headers that describe the rows in a response. */
alias RangeResponseHeaders = {
  /** Range of the returned or affected rows, and the total when counted. */
  @header("Content-Range") contentRange?: ContentRange;

  /** Unit of `Content-Range`. */
  @header("Range-Unit") rangeUnit?: "items";
};

/** Header on error responses. */
alias ProxyStatusHeader = {
  /**
   * Proxy status (RFC 9209) with the error code. Useful for HEAD requests,
   * which have no body.
   */
  @header("Proxy-Status")
  @example("PostgREST; error=57014")
  proxyStatus?: string;
};
