# Get OpenAPI Spec

Retrieve the OpenAPI description PostgREST publishes for a schema.

## API

- `GET /` with `Accept: application/openapi+json`
- `Accept-Profile: <schema>` selects a schema other than the first exposed one

## Behavior

PostgREST answers with an OpenAPI 2.0 (Swagger) document. `paths` lists the tables, views and functions in the schema, `definitions` describes table shapes, and `parameters` holds the reusable query parameters.

The document is filtered by the role in the request. With `openapi-mode` set to `follow-privileges` (the default), only objects the role holds privileges on appear. `ignore-privileges` returns every object in the schema.

The request carries the same credentials as any other query, so the description is scoped to the signed-in user rather than the anonymous role.

A `db-root-spec` function replaces the generated document with the function's result. That result is not required to be a Swagger document, so consumers must not assume any field beyond `swagger`, `info` and `paths`.

## Prerequisites

The schema must be listed in `db-schemas`. `openapi-mode` must not be `disabled`.

## Errors

- An error response when `openapi-mode` is `disabled`
- `PGRST106` when `Accept-Profile` names a schema that is not exposed
- Authentication errors such as `PGRST301` (expired JWT) apply as for any other request
