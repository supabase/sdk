#!/usr/bin/env python3
"""
Post-process the Smithy-generated OpenAPI JSON with patches that Smithy
cannot express natively.

Patches applied to every service:
  A. List-response envelope unwrap. The APIs return bare JSON arrays for list
     operations, but Smithy operation outputs must be structures, and restJson1
     forbids @httpPayload on list members ("AWS Protocols only support binding
     the following shape types to the payload: string, blob, structure, union,
     and document"). The model therefore wraps lists in an {items:[]} structure
     that does not exist on the wire; this patch unwraps it so response schemas
     are top-level arrays, matching production. Verified against a live
     platform: with the envelope, generated clients either fail to deserialize
     (NSwag: throws) or silently return empty results (Kiota: .Items == null).
  B. Optional scalar fields become nullable. Smithy marks non-@required members
     optional, but the OpenAPI conversion emits plain non-nullable schemas for
     them. Generators in languages with non-nullable value types (C#, Kotlin)
     then map them to types whose default is a real value (0/false) and
     serialize it — e.g. CreateBucket with file_size_limit:0 creates a bucket
     that rejects every upload with 413, and ListObjects with limit:0 is a 400.
     nullable:true lets generators produce optional value types (long?, int?).
  C. Greedy path label cleanup. Smithy's {wildcardPath+} greedy label leaks the
     RFC-6570 '+' into OpenAPI path templates and parameter names, producing
     invalid identifiers in generated code (24 C# compile errors observed).
  D. Streaming bodies become inline binary. @streaming blob / blob payloads
     convert to $ref'd schemas with format:byte (base64). Generators then
     buffer and base64-encode instead of streaming (NSwag emits byte[]).
     Replacing octet-stream content with inline {type:string, format:binary}
     makes generators emit true streams (NSwag: Stream/FileResponse; also what
     swift-openapi-generator needs to emit HTTPBody).

Service-specific patches:
  E. Storage — UploadObject / UpdateObject requestBody: inject
     multipart/form-data schema. Smithy has no native multipart/form-data
     support. The @httpMultipartForm trait in the model documents intent; this
     script performs the actual injection. Non-file parts are optional.
  F. Database — FilterOperator enum: defined in Smithy but not referenced as a
     member type (filter map values are raw strings), so it is absent from the
     generated output. Injected here so OpenAPI-based generators emit it.
"""
import json
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "output/openapi/StorageService.openapi.json"

with open(path) as f:
    d = json.load(f)

service_title = d.get("info", {}).get("title", "")
schemas = d.get("components", {}).get("schemas", {})
removed = []


def iter_operations(doc):
    for p, methods in doc.get("paths", {}).items():
        for method, op in methods.items():
            if isinstance(op, dict):
                yield op


def iter_contents(op):
    body = op.get("requestBody", {})
    if isinstance(body, dict):
        yield body.get("content", {})
    for resp in op.get("responses", {}).values():
        if isinstance(resp, dict):
            yield resp.get("content", {})


# ── Patch A: unwrap {items:[]} list-response envelopes ─────────────────────
def is_items_envelope(schema):
    return (
        isinstance(schema, dict)
        and schema.get("type") == "object"
        and set(schema.get("properties", {}).keys()) == {"items"}
        and schema["properties"]["items"].get("type") == "array"
    )


envelopes = {name for name, s in schemas.items() if is_items_envelope(s)}
for op in iter_operations(d):
    for resp in op.get("responses", {}).values():
        for media in resp.get("content", {}).values():
            ref = media.get("schema", {}).get("$ref", "")
            name = ref.rsplit("/", 1)[-1]
            if name in envelopes:
                media["schema"] = schemas[name]["properties"]["items"]

# ── Patch B: optional scalar properties → nullable ─────────────────────────
SCALARS = ("number", "integer", "boolean")
for s in schemas.values():
    if not isinstance(s, dict) or s.get("type") != "object":
        continue
    required = set(s.get("required", []))
    for prop_name, prop in s.get("properties", {}).items():
        if prop_name in required or not isinstance(prop, dict):
            continue
        if prop.get("type") in SCALARS:
            prop["nullable"] = True

# ── Patch C: strip greedy-label '+' from paths and parameter names ─────────
d["paths"] = {p.replace("+}", "}"): v for p, v in d.get("paths", {}).items()}
for op in iter_operations(d):
    for param in op.get("parameters", []):
        if isinstance(param, dict) and param.get("name", "").endswith("+"):
            param["name"] = param["name"].rstrip("+")

# ── Patch D: octet-stream $ref bodies → inline binary ──────────────────────
inlined_refs = set()
for op in iter_operations(d):
    for content in iter_contents(op):
        media = content.get("application/octet-stream")
        if media and "$ref" in media.get("schema", {}):
            inlined_refs.add(media["schema"]["$ref"].rsplit("/", 1)[-1])
            media["schema"] = {"type": "string", "format": "binary"}

# ── Cleanup: drop components orphaned by patches A and D ───────────────────
doc_json = json.dumps(d)
for name in envelopes | inlined_refs:
    if f'"#/components/schemas/{name}"' not in doc_json:
        schemas.pop(name, None)
        removed.append(name)

# ── Patch F: FilterOperator enum (DatabaseService only) ────────────────────
if service_title == "Supabase Database API":
    schemas["FilterOperator"] = {
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
    print(f"Patched (database): {path}" + (f" — removed {removed}" if removed else ""))
    sys.exit(0)

# ── Patch E: multipart/form-data for UploadObject and UpdateObject ─────────
MULTIPART_BODY = {
    "required": True,
    "content": {
        "multipart/form-data": {
            "schema": {
                "type": "object",
                "required": ["file"],
                "properties": {
                    "file": {"type": "string", "format": "binary"},
                    "cacheControl": {"type": "string"},
                    "metadata": {"type": "object"},
                },
            }
        }
    },
}

upload_path = "/object/{bucketId}/{wildcardPath}"
if upload_path in d.get("paths", {}):
    for method in ("post", "put"):
        if method in d["paths"][upload_path]:
            d["paths"][upload_path][method]["requestBody"] = MULTIPART_BODY

with open(path, "w") as f:
    json.dump(d, f, indent=2)

label = "storage" if "Storage" in service_title else "functions"
print(f"Patched ({label}): {path}" + (f" — removed {removed}" if removed else ""))
