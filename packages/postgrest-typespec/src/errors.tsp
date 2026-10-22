import "@typespec/http";

using Http;

namespace PostgREST;

/**
 * Error code. PostgREST codes have the form `PGRST<group><id>`. Other values
 * are PostgreSQL SQLSTATE codes forwarded from the database (for example
 * `23505`), or custom codes raised by database functions (`PT402`, or any code
 * raised with SQLSTATE `PGRST`).
 */
union ErrorCode {
  /** 503: cannot connect to the database (bad `db-uri` or PostgreSQL not running). */
  PGRST000: "PGRST000",

  /** 503: cannot connect to the database due to an internal error. */
  PGRST001: "PGRST001",

  /** 503: cannot connect to the database while building the schema cache. */
  PGRST002: "PGRST002",

  /** 504: timed out waiting for a pool connection (`db-pool-acquisition-timeout`). */
  PGRST003: "PGRST003",

  /** 400: cannot parse a query string parameter. */
  PGRST100: "PGRST100",

  /** 405: functions accept only GET and POST. */
  PGRST101: "PGRST101",

  /** 400: invalid request body, such as an empty body or malformed JSON. */
  PGRST102: "PGRST102",

  /** 416: invalid range for limits and pagination. */
  PGRST103: "PGRST103",

  /** 405: invalid PUT request. */
  PGRST105: "PGRST105",

  /** 406: the requested schema is not in `db-schemas`. */
  PGRST106: "PGRST106",

  /** 406: the `Accept` media type is not available. */
  PGRST107: "PGRST107",

  /** 400: filter on an embedded resource that is not in `select`. */
  PGRST108: "PGRST108",

  /** 500: a function set an invalid `response.headers`. */
  PGRST111: "PGRST111",

  /** 500: a function set a `response.status` that is not a positive integer. */
  PGRST112: "PGRST112",

  /** 400: PUT used with limits or offsets. */
  PGRST114: "PGRST114",

  /** 400: PUT primary key in the query string differs from the body. */
  PGRST115: "PGRST115",

  /** 406: a singular response was requested, but the result does not have exactly one row. */
  PGRST116: "PGRST116",

  /** 405: unsupported HTTP method. */
  PGRST117: "PGRST117",

  /** 400: cannot order by a related table without a to-one relationship. */
  PGRST118: "PGRST118",

  /** 400: an embedded resource can only be filtered with `is.null` or `not.is.null`. */
  PGRST120: "PGRST120",

  /** 500: cannot parse the JSON in a RAISE with SQLSTATE `PGRST`. */
  PGRST121: "PGRST121",

  /** 400: invalid preferences with `handling=strict`. */
  PGRST122: "PGRST122",

  /** 400: aggregate functions are disabled (`db-aggregates-enabled`). */
  PGRST123: "PGRST123",

  /** 400: the `max-affected` preference is violated. */
  PGRST124: "PGRST124",

  /** 404: invalid path in the request URL. */
  PGRST125: "PGRST125",

  /** 404: the root path was requested, but OpenAPI is disabled (`openapi-mode`). */
  PGRST126: "PGRST126",

  /** 400: the feature named in `details` is not implemented. */
  PGRST127: "PGRST127",

  /** 400: `max-affected` used on a function that does not return SETOF or TABLE. */
  PGRST128: "PGRST128",

  /** 400: `timezone` preference longer than 24 characters on affected PostgreSQL versions. */
  PGRST129: "PGRST129",

  /** 400: relationship not found in the schema cache. */
  PGRST200: "PGRST200",

  /** 300: ambiguous embedding; more than one relationship matches. */
  PGRST201: "PGRST201",

  /** 404: function not found in the schema cache. */
  PGRST202: "PGRST202",

  /** 300: ambiguous call of overloaded functions. */
  PGRST203: "PGRST203",

  /** 400: a column in the `columns` parameter does not exist. */
  PGRST204: "PGRST204",

  /** 404: table or view not found in the schema cache. */
  PGRST205: "PGRST205",

  /** 500: the JWT secret is missing from the configuration. */
  PGRST300: "PGRST300",

  /** 401: the JWT cannot be decoded or is invalid. */
  PGRST301: "PGRST301",

  /** 401: no bearer token, and the anonymous role is disabled. */
  PGRST302: "PGRST302",

  /** 401: JWT claims validation or parsing failed. */
  PGRST303: "PGRST303",

  /** 500: internal error of the database connection library. */
  PGRSTX00: "PGRSTX00",

  string,
}

/**
 * Error body. It follows the PostgreSQL error structure. With
 * `client-error-verbosity=minimal` only `code` and `message` are present.
 */
model PostgrestError {
  code: ErrorCode;
  message: string;
  details?: string | null;
  hint?: string | null;
}

/** Fields shared by every error response. */
alias ErrorFields = {
  ...ProxyStatusHeader;
  @header("Content-Type") contentType: "application/json";
  @body body: PostgrestError;
};

/** Ambiguous embedding (PGRST201) or ambiguous overloaded function (PGRST203). */
@error
model AmbiguousError {
  @statusCode statusCode: 300;
  ...ErrorFields;
}

/**
 * Invalid request (PGRST1xx, PGRST200, PGRST204), or a database error without
 * a more specific mapping, such as a constraint violation or `RAISE` (P0001).
 */
@error
model BadRequestError {
  @statusCode statusCode: 400;
  ...ErrorFields;
}

/**
 * Invalid or missing JWT (PGRST301 to PGRST303), or insufficient privileges
 * (42501) for an anonymous request.
 */
@error
model UnauthorizedError {
  @statusCode statusCode: 401;
  ...ErrorFields;
}

/** Insufficient privileges (42501) for an authenticated request. */
@error
model ForbiddenError {
  @statusCode statusCode: 403;
  ...ErrorFields;
}

/**
 * Unknown table, view or function (PGRST202, PGRST205, 42P01, 42883), or an
 * invalid path (PGRST125).
 */
@error
model NotFoundError {
  @statusCode statusCode: 404;
  ...ErrorFields;
}

/** Method not allowed for the resource (PGRST101, PGRST105, PGRST117, 25006). */
@error
model MethodNotAllowedError {
  @statusCode statusCode: 405;
  ...ErrorFields;
}

/** Unknown schema (PGRST106), unavailable media type (PGRST107), or not exactly one row for a singular response (PGRST116). */
@error
model NotAcceptableError {
  @statusCode statusCode: 406;
  ...ErrorFields;
}

/** Foreign key (23503) or uniqueness (23505) violation. */
@error
model ConflictError {
  @statusCode statusCode: 409;
  ...ErrorFields;
}

/** Invalid range (PGRST103). */
@error
model RangeNotSatisfiableError {
  @statusCode statusCode: 416;
  ...ErrorFields;
}

/** Server or database error. */
@error
model InternalServerError {
  @statusCode statusCode: 500;
  ...ErrorFields;
}

/** The database is unavailable (PGRST000 to PGRST002, 08*, 53*). */
@error
model ServiceUnavailableError {
  @statusCode statusCode: 503;
  ...ErrorFields;
}

/** Timed out waiting for a database connection (PGRST003). */
@error
model GatewayTimeoutError {
  @statusCode statusCode: 504;
  ...ErrorFields;
}

/**
 * Any other status. Database functions can respond with any status by raising
 * SQLSTATE `PTxyz` (status `xyz`), or SQLSTATE `PGRST` with the status in the
 * error detail.
 */
@error
model CustomError {
  ...ErrorFields;
}

/**
 * Error of a HEAD request. There is no body; `Proxy-Status` carries the error
 * code.
 */
@error
model HeadError {
  @statusCode statusCode:
    | 300
    | 400
    | 401
    | 403
    | 404
    | 405
    | 406
    | 416
    | 500
    | 503
    | 504;
  ...ProxyStatusHeader;
}

/** Errors that any request can return. */
alias CommonErrors =
  | BadRequestError
  | UnauthorizedError
  | ForbiddenError
  | NotFoundError
  | MethodNotAllowedError
  | NotAcceptableError
  | InternalServerError
  | ServiceUnavailableError
  | GatewayTimeoutError
  | CustomError;
