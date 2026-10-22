import "@typespec/http";
import "@typespec/openapi";

using Http;
using OpenAPI;

namespace PostgREST;

/** Path of a function. */
model FunctionPath {
  /** Function in the selected schema. */
  @path("function") functionName: ResourceName;
}

/** Function result as JSON: a scalar, an object, or an array of rows. */
model JsonValue<Status, Headers extends {}> {
  @statusCode statusCode: Status;
  ...Headers;
  @header("Content-Type") contentType: "application/json";
  @body body: unknown;
}

/**
 * Every representation of a function result. Scalar functions return the
 * value. Table-valued functions return rows, like tables and views.
 */
alias FunctionRepresentation<Status, Headers extends {}> =
  | JsonValue<Status, Headers>
  | ArrayRows<Status, Headers>
  | ObjectRow<Status, Headers>
  | CsvRows<Status, Headers>
  | GeoJsonRows<Status, Headers>
  | TextPlan<Status, Headers>
  | JsonPlan<Status, Headers>
  | HandlerOutput<Status, Headers>;

/** The function returns `void`. */
model VoidResponse {
  @statusCode statusCode: 204;
  ...CommonResponseHeaders;
}

/** Every response of a function call. */
alias FunctionResponses =
  | FunctionRepresentation<200 | 206, ReadResponseHeaders>
  | VoidResponse
  | AmbiguousError
  | RangeNotSatisfiableError
  | CommonErrors;

/**
 * Parameters of a function call that shape a table-valued result, as for
 * tables and views.
 */
model ResultParameters {
  ...SelectParameter;
  ...PaginationParameters;

  /** At least one of the conditions holds. */
  @query or?: LogicalExpression;

  /** All conditions hold. */
  @query and?: LogicalExpression;

  /** Not all of the conditions hold. */
  @query("not.or") notOr?: LogicalExpression;

  /** Not all of the conditions hold. */
  @query("not.and") notAnd?: LogicalExpression;
}

/** A JSON object of named arguments. */
alias JsonArguments = {
  @header("Content-Type") contentType: "application/json";

  /**
   * One key per argument name. Arguments with a DEFAULT can be omitted. A
   * variadic argument takes a JSON array. For a function with a single unnamed
   * `json` or `jsonb` parameter, the whole body is that argument.
   */
  @body body: Record<unknown> | unknown[];
};

/** URL-encoded named arguments. Repeat a key for a variadic argument. */
alias FormArguments = {
  @header("Content-Type") contentType: "application/x-www-form-urlencoded";
  @body body: Record<string>;
};

/** Raw binary for a function with a single unnamed `bytea` parameter. */
alias BinaryArgument = {
  @header("Content-Type") contentType: "application/octet-stream";
  @body body: bytes;
};

/** Raw text for a function with a single unnamed `text` parameter. */
alias TextArgument = {
  @header("Content-Type") contentType: "text/plain";
  @body body: string;
};

/** Raw XML for a function with a single unnamed `xml` parameter. */
alias XmlArgument = {
  @header("Content-Type") contentType: "text/xml";
  @body body: string;
};

op Call<Payload extends {}>(
  ...FunctionPath,
  ...ResultParameters,

  /** Horizontal filters on a table-valued result. See `FilterParameters`. */
  @query(#{ explode: true })
  filters?: Record<string>,

  ...AcceptHeader,
  ...ContentProfileHeader,
  ...RangeRequestHeaders,
  ...PreferHeader<FunctionPreference>,
  ...Payload,
): FunctionResponses;

/**
 * Functions of the exposed schema, under the `/rpc` prefix. Functions are
 * called with the privileges of the request role. VOLATILE functions accept
 * only POST; STABLE and IMMUTABLE functions also accept GET and HEAD
 * (PGRST101 otherwise). Stored procedures are not supported.
 */
@route("/rpc/{function}")
@tag("Functions")
interface Functions {
  /**
   * Calls a STABLE or IMMUTABLE function with GET. The query string carries
   * the arguments, plus filters, ordering and pagination for a table-valued
   * result.
   */
  @summary("Call a function with GET")
  @get
  call(
    ...FunctionPath,
    ...ResultParameters,

    /**
     * Function arguments and horizontal filters, one query parameter per
     * entry. A key that names a function parameter is an argument (repeat it
     * for a variadic argument, and pass arrays as literals such as
     * `{1,2,3}`). Any other key is a filter on a table-valued result, with the
     * same grammar as `FilterParameters`.
     */
    @query(#{ explode: true })
    arguments?: Record<string>,

    ...AcceptHeader,
    ...AcceptProfileHeader,
    ...RangeRequestHeaders,
    ...PreferHeader<FunctionPreference>,
  ): FunctionResponses;

  /** Same as `call`, without a response body. */
  @summary("Call a function with HEAD")
  @head
  callHead(
    ...FunctionPath,
    ...ResultParameters,

    /** Function arguments and horizontal filters. See `call`. */
    @query(#{ explode: true })
    arguments?: Record<string>,

    ...AcceptHeader,
    ...AcceptProfileHeader,
    ...RangeRequestHeaders,
    ...PreferHeader<FunctionPreference>,
  ):
    | {
        @statusCode statusCode: 200 | 206 | 204;
        ...ReadResponseHeaders;
      }
    | HeadError;

  /**
   * Calls a function with POST. Every function accepts POST, whatever its
   * volatility. Filters, ordering and pagination in the query string apply to a
   * table-valued result.
   */
  @summary("Call a function with POST")
  @post
  @sharedRoute
  @operationId("Functions_invoke")
  invoke is Call<JsonArguments>;

  @post
  @sharedRoute
  @operationId("Functions_invoke")
  invokeForm is Call<FormArguments>;

  @post
  @sharedRoute
  @operationId("Functions_invoke")
  invokeBinary is Call<BinaryArgument>;

  @post
  @sharedRoute
  @operationId("Functions_invoke")
  invokeText is Call<TextArgument>;

  @post
  @sharedRoute
  @operationId("Functions_invoke")
  invokeXml is Call<XmlArgument>;
}
