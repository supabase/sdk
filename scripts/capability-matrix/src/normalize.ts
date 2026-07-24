// Normalizes an upstream OpenAPI document in place so it generates clean,
// compilable client code. The document is loosely typed (OpenAPI is huge);
// we operate on the few shapes we care about.
type OpenApiDoc = Record<string, any>;

const HTTP_METHODS = ["get", "put", "post", "delete", "patch", "head", "options"] as const;

export interface NormalizeOptions {
  wildcardParamName?: string;
  schemaRenames?: Record<string, string>;
  operationIdOverrides?: Record<string, string>;
  requestBodyInjections?: Record<string, unknown>;
}

/** Replaces `{*}` path segments (Fastify wildcards) and their `*`-named path params. */
export function renameWildcardParams(spec: OpenApiDoc, paramName = "objectPath"): OpenApiDoc {
  const paths = spec.paths ?? {};
  for (const key of Object.keys(paths)) {
    if (!key.includes("{*}")) continue;
    const newKey = key.split("{*}").join(`{${paramName}}`);
    const item = paths[key];
    const paramArrays = [item.parameters, ...HTTP_METHODS.map((m) => item[m]?.parameters)];
    for (const params of paramArrays) {
      if (!Array.isArray(params)) continue;
      for (const p of params) {
        if (p && p.in === "path" && p.name === "*") p.name = paramName;
      }
    }
    delete paths[key];
    paths[newKey] = item;
  }
  return spec;
}

/** Renames component schemas and rewrites every `$ref` that pointed at them. */
export function renameSchemas(spec: OpenApiDoc, renames: Record<string, string>): OpenApiDoc {
  const schemas = spec.components?.schemas ?? {};
  const refMap = new Map<string, string>();
  for (const [oldName, newName] of Object.entries(renames)) {
    if (oldName === newName) continue;
    if (schemas[oldName] === undefined) continue;
    schemas[newName] = schemas[oldName];
    delete schemas[oldName];
    refMap.set(`#/components/schemas/${oldName}`, `#/components/schemas/${newName}`);
  }
  const walk = (node: any): void => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node && typeof node === "object") {
      if (typeof node.$ref === "string" && refMap.has(node.$ref)) node.$ref = refMap.get(node.$ref)!;
      for (const v of Object.values(node)) walk(v);
    }
  };
  walk(spec);
  return spec;
}

/** Deterministic, unique-ish id from method + path (params rendered as `By <Name>`). */
export function deriveOperationId(method: string, path: string): string {
  const tokens: string[] = [method];
  for (const seg of path.split("/").filter(Boolean)) {
    const m = seg.match(/^\{(.+)\}$/);
    if (m) {
      // Preserve the param name casing; prefix with "By" as a separate token so
      // the loop capitalises "By" but leaves the param name intact.
      const name = m[1];
      tokens.push("By");
      tokens.push(name);
    } else {
      tokens.push(seg);
    }
  }
  // Capitalise first letter of each token (except the first, which is lowercased),
  // keeping param names verbatim so `bucketId` stays `bucketId` rather than `bucketid`.
  const result: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (i === 0) {
      result.push(t.toLowerCase());
    } else {
      result.push(t[0].toUpperCase() + t.slice(1));
    }
  }
  return result.join("");
}

/** Sets `operationId` on every operation lacking one (override map wins; guarantees uniqueness). */
export function injectOperationIds(spec: OpenApiDoc, overrides: Record<string, string> = {}): OpenApiDoc {
  const used = new Set<string>();
  const paths = spec.paths ?? {};
  for (const path of Object.keys(paths)) {
    for (const m of HTTP_METHODS) {
      const op = paths[path]?.[m];
      if (op?.operationId) used.add(op.operationId);
    }
  }
  for (const path of Object.keys(paths)) {
    for (const m of HTTP_METHODS) {
      const op = paths[path]?.[m];
      if (!op || op.operationId) continue;
      const base = overrides[`${m.toUpperCase()} ${path}`] ?? deriveOperationId(m, path);
      let id = base;
      let n = 2;
      while (used.has(id)) id = `${base}${n++}`;
      op.operationId = id;
      used.add(id);
    }
  }
  return spec;
}

/** Adds a requestBody to operations that lack one. Keyed "METHOD /path" (normalized path). */
export function injectRequestBodies(spec: OpenApiDoc, injections: Record<string, unknown>): OpenApiDoc {
  const paths = spec.paths ?? {};
  for (const [key, body] of Object.entries(injections)) {
    const sp = key.indexOf(" ");
    if (sp < 0) continue;
    const method = key.slice(0, sp).toLowerCase();
    const path = key.slice(sp + 1);
    const op = paths[path]?.[method];
    if (op && op.requestBody === undefined) op.requestBody = body;
  }
  return spec;
}

/** Returns override keys ("METHOD /path") that match no operation in the spec. */
export function findUnmatchedOverrides(spec: OpenApiDoc, overrides: Record<string, unknown>): string[] {
  const paths = spec.paths ?? {};
  return Object.keys(overrides).filter((key) => {
    const sp = key.indexOf(" ");
    if (sp < 0) return true;
    const method = key.slice(0, sp).toLowerCase();
    const path = key.slice(sp + 1);
    return !paths[path]?.[method];
  });
}

/**
 * Removes duplicate property names that differ only in case (e.g. `Id` vs `id`).
 * Generators that map property names to camelCase can produce conflicting Swift/Kotlin
 * declarations when the spec has both. The lowercase variant is canonical; all
 * PascalCase or mixed-case duplicates are dropped.
 *
 * LOSSY: when a collision is resolved the non-lowercase key is silently dropped, so
 * callers only see the lowercase variant in the normalised output.  In particular, the
 * kept variant may be the nullable one — e.g. the `POST /object/copy` response has both
 * `Id` (non-nullable) and `id` (nullable); after dedup only `id` (nullable) survives.
 * Downstream generated types therefore reflect the nullable shape even where the
 * non-nullable sibling would have been more accurate.
 */
export function dedupCaseInsensitiveProperties(spec: OpenApiDoc): OpenApiDoc {
  const walk = (node: any): void => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node && typeof node === "object") {
      if (node.properties && typeof node.properties === "object" && !Array.isArray(node.properties)) {
        const props: Record<string, any> = node.properties;
        const seen = new Map<string, string>(); // lowercase -> first key seen
        for (const key of Object.keys(props)) {
          const lk = key.toLowerCase();
          if (seen.has(lk)) {
            // Keep the lowercase variant; drop the non-lowercase one
            const existing = seen.get(lk)!;
            if (existing === existing.toLowerCase()) {
              // existing is already lowercase; drop current key
              delete props[key];
            } else {
              // existing is not lowercase; replace with current (closer to lowercase)
              delete props[existing];
              seen.set(lk, key);
            }
          } else {
            seen.set(lk, key);
          }
        }
      }
      for (const v of Object.values(node)) walk(v);
    }
  };
  walk(spec);
  return spec;
}

/**
 * Converts OAS 3.1-style nullable arrays (`type: ["null", "T"]`) to OAS 3.0 form
 * (`type: "T", nullable: true`). Also flattens single-element type arrays.
 * Operates recursively on the whole document.
 */
export function fixArrayTypes(spec: OpenApiDoc): OpenApiDoc {
  const walk = (node: any): void => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node && typeof node === "object") {
      if (Array.isArray(node.type)) {
        const types: string[] = node.type;
        const nonNull = types.filter((t) => t !== "null");
        if (types.includes("null")) node.nullable = true;
        node.type = nonNull.length === 1 ? nonNull[0] : nonNull.length === 0 ? undefined : nonNull;
        if (node.type === undefined) delete node.type;
      }
      for (const v of Object.values(node)) walk(v);
    }
  };
  walk(spec);
  return spec;
}

/**
 * Removes `$comment` keys from every schema object in the document.
 * `$comment` is a JSON Schema / OAS 3.1 annotation; OAS 3.0 does not allow it.
 */
export function stripDollarComments(spec: OpenApiDoc): OpenApiDoc {
  const walk = (node: any): void => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node && typeof node === "object") {
      if ("$comment" in node) delete node.$comment;
      for (const v of Object.values(node)) walk(v);
    }
  };
  walk(spec);
  return spec;
}

/**
 * Removes `examples` (plural array form) from schema objects.
 * OAS 3.0 uses the singular `example` keyword; the plural `examples` is OAS 3.1.
 * We only strip it when it sits on a schema node (has `type`, `$ref`, `properties`,
 * `allOf`, `oneOf`, or `anyOf`) to avoid touching parameter-level `examples` maps.
 */
export function stripSchemaExamples(spec: OpenApiDoc): OpenApiDoc {
  const SCHEMA_SIGNALS = new Set(["type", "$ref", "properties", "allOf", "oneOf", "anyOf", "items", "nullable", "format"]);
  const walk = (node: any): void => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node && typeof node === "object") {
      const isSchemaNode = Object.keys(node).some((k) => SCHEMA_SIGNALS.has(k));
      if (isSchemaNode && Array.isArray(node.examples)) delete node.examples;
      for (const v of Object.values(node)) walk(v);
    }
  };
  walk(spec);
  return spec;
}

/**
 * PILOT STOPGAP — replaces any external (`http(s)://`) `$ref` with a permissive open
 * object schema `{ type: "object" }`.  This discards the referenced schema's real shape
 * entirely; the original URL is preserved in `x-inlined-from` for traceability only.
 *
 * As of the initial Storage codegen pilot the only affected site is the QueryVectors
 * request body, whose `$ref` points at an external Hnswlib spec.  That one case does
 * not yet block generation, but the substitution is semantically wrong.
 *
 * Follow-up actions before this leaves pilot status:
 *   1. Narrow the matcher or vendor the real external schema so the correct shape is
 *      emitted for known refs (analogous to `schemaRenames` for local refs).
 *   2. Consider failing loudly — similar to how `findUnmatchedOverrides` surfaces
 *      unrecognised override keys — for any external ref that is not explicitly
 *      allow-listed, so new upstream refs do not silently degrade codegen quality.
 *
 * The openapi-generator validator rejects any ref it cannot resolve at generation time,
 * which is why we must substitute something; the open-object fallback is the safest
 * no-op that keeps generation green while the proper fix is tracked.
 */
export function inlineExternalRefs(spec: OpenApiDoc): OpenApiDoc {
  const walk = (node: any): void => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node && typeof node === "object") {
      if (typeof node.$ref === "string" && /^https?:\/\//.test(node.$ref)) {
        const originalRef = node.$ref;
        delete node.$ref;
        // Make it a permissive object schema so the generator still emits something
        node.type = "object";
        node["x-inlined-from"] = originalRef;
      }
      for (const v of Object.values(node)) walk(v);
    }
  };
  walk(spec);
  return spec;
}

/** Full normalization: wildcard params, then schema renames, then operationId injection. */
export function normalizeSpec(spec: OpenApiDoc, options: NormalizeOptions = {}): OpenApiDoc {
  renameWildcardParams(spec, options.wildcardParamName ?? "objectPath");
  if (options.schemaRenames) renameSchemas(spec, options.schemaRenames);
  injectOperationIds(spec, options.operationIdOverrides ?? {});
  if (options.requestBodyInjections) injectRequestBodies(spec, options.requestBodyInjections);
  fixArrayTypes(spec);
  stripDollarComments(spec);
  stripSchemaExamples(spec);
  inlineExternalRefs(spec);
  dedupCaseInsensitiveProperties(spec);
  return spec;
}
