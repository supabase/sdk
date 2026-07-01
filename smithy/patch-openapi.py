#!/usr/bin/env python3
"""
Post-process the Smithy-generated OpenAPI JSON with patches that Smithy
cannot express natively.

Storage patches:
  1. UploadChunk body: format: byte → format: binary
     (@streaming blob translates to format:byte but swift-openapi-generator
      needs format:binary to emit HTTPBody instead of Base64EncodedData)
  2. UploadObject (POST) and UpdateObject (PUT) with multipart/form-data
     (Smithy has no native multipart/form-data trait; these are authored here)

Database patches:
  3. FilterOperator enum — defined in Smithy but not referenced as a member
     type (filter map values are raw strings), so it is absent from the
     generated output. Injected here so OpenAPI-based generators emit it.
"""
import json
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "output/openapi/StorageService.openapi.json"

with open(path) as f:
    d = json.load(f)

service_title = d.get("info", {}).get("title", "")

# ── Patch 3: FilterOperator enum (DatabaseService only) ───────────────────
if service_title == "Supabase Database API":
    d["components"]["schemas"]["FilterOperator"] = {
        "type": "string",
        "description": (
            "PostgREST column filter operators. "
            "Format a filter value as \"{operator}.{value}\", e.g. \"eq.5\". "
            "Prefix with \"not.\" to negate: \"not.eq.5\". "
            "For logical grouping use keys \"or\" / \"and\" in the filters map."
        ),
        "enum": [
            "eq", "neq", "lt", "lte", "gt", "gte",
            "like", "ilike", "match", "imatch",
            "is", "isdistinct", "in",
            "cs", "cd", "ov",
            "sl", "sr", "nxl", "nxr", "adj",
            "fts", "plfts", "phfts", "wfts",
        ],
    }
    with open(path, "w") as f:
        json.dump(d, f, indent=4)
    print(f"Patched (database): {path}")
    sys.exit(0)

# ── Patch 1: streaming blob → binary ─────────────────────────────────────
schema = d["components"]["schemas"].get("UploadChunkInputPayload", {})
if schema.get("format") == "byte":
    schema["format"] = "binary"

# ── Patch 2: multipart upload/update operations ───────────────────────────
d["components"]["schemas"]["FileUploadedResponse"] = {
    "type": "object",
    "properties": {
        "Key": {"type": "string"},
        "Id": {"type": "string", "format": "uuid"},
    },
    "required": ["Key", "Id"],
}

upload_form_schema = {
    "type": "object",
    "properties": {
        "cacheControl": {"type": "string"},
        "metadata": {"type": "object", "additionalProperties": True},
        "file": {"type": "string", "format": "binary"},
    },
    "required": ["file"],
}

upload_responses = {
    "200": {
        "description": "Upload successful",
        "content": {
            "application/json": {
                "schema": {"$ref": "#/components/schemas/FileUploadedResponse"}
            }
        },
    },
    "400": {
        "description": "StorageError 400 response",
        "content": {
            "application/json": {
                "schema": {"$ref": "#/components/schemas/StorageErrorResponseContent"}
            }
        },
    },
}

wildcard_path = "/object/{bucketId}/{wildcardPath+}"
d["paths"][wildcard_path]["post"] = {
    "operationId": "UploadObject",
    "parameters": [
        {"name": "bucketId", "in": "path", "schema": {"type": "string"}, "required": True},
        {"name": "wildcardPath+", "in": "path", "schema": {"type": "string"}, "required": True},
        {"name": "x-upsert", "in": "header", "schema": {"type": "string"}, "required": False},
    ],
    "requestBody": {
        "required": True,
        "content": {"multipart/form-data": {"schema": upload_form_schema}},
    },
    "responses": upload_responses,
}

d["paths"][wildcard_path]["put"] = {
    "operationId": "UpdateObject",
    "parameters": [
        {"name": "bucketId", "in": "path", "schema": {"type": "string"}, "required": True},
        {"name": "wildcardPath+", "in": "path", "schema": {"type": "string"}, "required": True},
    ],
    "requestBody": {
        "required": True,
        "content": {"multipart/form-data": {"schema": upload_form_schema}},
    },
    "responses": upload_responses,
}

with open(path, "w") as f:
    json.dump(d, f, indent=2)
