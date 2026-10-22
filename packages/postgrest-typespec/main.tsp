import "@typespec/http";
import "@typespec/openapi";
import "./src/grammar.tsp";
import "./src/preferences.tsp";
import "./src/headers.tsp";
import "./src/parameters.tsp";
import "./src/representations.tsp";
import "./src/errors.tsp";
import "./src/relations.tsp";
import "./src/functions.tsp";
import "./src/root.tsp";

using Http;
using OpenAPI;

/**
 * The HTTP API that every PostgREST server exposes, independent of the database
 * schema behind it.
 *
 * PostgREST serves each table, view and function of the exposed schema(s) as a
 * resource. The resource names, columns and function arguments depend on the
 * database, so this model treats them as opaque: rows are JSON objects, filters
 * are query parameters keyed by column name, and function arguments are JSON
 * object keys or query parameters keyed by argument name. Everything that does
 * not depend on the schema (the URL grammar, headers, preferences, media types,
 * status codes and errors) is modeled precisely.
 *
 * Reference: https://docs.postgrest.org/en/v16/references/api.html
 */
@service(#{ title: "PostgREST" })
@info(#{
  version: "16",
  license: #{
    name: "MIT",
    url: "https://github.com/PostgREST/postgrest/blob/main/LICENSE",
  },
})
@server(
  "{endpoint}",
  "A PostgREST server",
  {
    endpoint?: url = "http://localhost:3000",
  }
)
@tagMetadata(
  "Tables and Views",
  #{ description: "Tables, views and foreign tables of the exposed schema." }
)
@tagMetadata(
  "Functions",
  #{ description: "Functions of the exposed schema, called as RPC." }
)
@tagMetadata(
  "OpenAPI",
  #{
    description: "The schema-specific OpenAPI description that PostgREST generates.",
  }
)
@useAuth(BearerAuth | NoAuth)
namespace PostgREST;
