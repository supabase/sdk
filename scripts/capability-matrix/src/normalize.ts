// Normalizes an upstream OpenAPI document in place so it generates clean,
// compilable client code. The document is loosely typed (OpenAPI is huge);
// we operate on the few shapes we care about.
type OpenApiDoc = Record<string, any>;

const HTTP_METHODS = ["get", "put", "post", "delete", "patch", "head", "options"] as const;

export interface NormalizeOptions {
  wildcardParamName?: string;
  schemaRenames?: Record<string, string>;
  operationIdOverrides?: Record<string, string>;
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

/** Full normalization: wildcard params, then schema renames, then operationId injection. */
export function normalizeSpec(spec: OpenApiDoc, options: NormalizeOptions = {}): OpenApiDoc {
  renameWildcardParams(spec, options.wildcardParamName ?? "objectPath");
  if (options.schemaRenames) renameSchemas(spec, options.schemaRenames);
  injectOperationIds(spec, options.operationIdOverrides ?? {});
  return spec;
}
