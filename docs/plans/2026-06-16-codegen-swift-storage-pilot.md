# Swift Storage codegen pilot (in-repo) implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the codegen pipeline end-to-end **inside `supabase/sdk`**: normalize the upstream Storage OpenAPI spec, generate a zero-dependency Swift package from it with `openapi-generator`, commit the result, and have `swift build` pass — all reproducibly, with a drift guard and validated feature bindings.

**Architecture:** A committed, deterministic normalizer turns the pinned upstream Storage spec into a generation-ready normalized spec (injects `operationId`s, fixes Fastify `{*}` path params, renames `def-N` schemas). `codegen.yaml` declares the engine pin, the normalized spec, and a Swift target. A thin runner spawns `openapi-generator` (stock `swift6` generator + `nonPublicApi` config — no custom templates yet) to emit a committed Swift package under `codegen/generated/swift-storage/`. The validator gains an operationId cross-check so bindings can't reference operations that don't exist. The hand-written surface + conformance execution are deferred to Plan 3.

**Tech Stack:** TypeScript (ESM, `tsx`, `vitest`) for the normalizer/runner/validation — extends `scripts/capability-matrix`. `openapi-generator` 7.23.0 (on PATH at `/opt/homebrew/bin/openapi-generator`, needs Java — present). Swift 6.3.2 for `swift build`. All confirmed available in this environment.

**Depends on:** Plan 1 (committed) — `binding` field, `codegen.yaml` schema/loader, `checkBindings`, `buildGenerateArgs`, conformance format, and the `run()` wiring.

**Grounding facts (from `docs/plans/2026-06-16-codegen-swift-storage-spike.md`):**
- Pinned upstream spec: `https://raw.githubusercontent.com/supabase/storage/53e6a743d5b02e7e7e7b7549f7490517773be016/api.json` (OpenAPI 3.0.3, 52 paths, 108 operations).
- **0 of 108 operations have `operationId`.**
- **15 paths contain `{*}`** as their last segment, each with a path parameter literally named `*`. Uniform shape → one rule fixes all.
- Two component schemas only: `def-0` (`title: authSchema`, 0 `$ref`s, orphan) and `def-1` (`title: errorSchema`: `statusCode`/`error`/`message`, 40 `$ref`s).
- Generator: `swift6` with `responseAs=AsyncAwait, library=urlsession, useSPMFileStructure=true` emits zero external deps; `Models/` compile cleanly; `nonPublicApi=true` makes APIs/Infrastructure internal.

**Conventions (from existing code):** ESM imports with **no file extension**; checks return `Finding[]`; schema validation via `compileSchema()`; YAML/JSON via `yaml`'s `parse`/`JSON`; tests via `vitest` with `mkdtempSync`/`tmpdir`. Run a single test: `cd scripts/capability-matrix && npx vitest run test/<file>.test.ts`. Typecheck: `npm run typecheck`.

**File map (new/changed):**
```
codegen.yaml                                  # NEW (root): engine pin + storage spec + swift target
codegen/normalize/storage.json                # NEW: storage normalize config (schema renames + operationId overrides)
codegen/specs/storage.upstream.json           # NEW: committed pinned fetch (provenance + offline source)
codegen/specs/storage.normalized.json         # NEW: committed normalizer output (generation input)
codegen/generated/swift-storage/              # NEW: committed generated Swift package (Package.swift + Sources/)
scripts/capability-matrix/src/normalize.ts        # NEW: pure normalizer transforms
scripts/capability-matrix/src/normalize-cli.ts    # NEW: CLI: upstream.json + config -> normalized.json
scripts/capability-matrix/src/generate.ts         # MODIFY: add runGenerate(); make --template-dir optional
scripts/capability-matrix/src/generate-cli.ts     # NEW: CLI: run openapi-generator for codegen.yaml targets
scripts/capability-matrix/src/codegen.ts          # MODIFY: optional templates + optional targets
scripts/capability-matrix/src/bindings.ts         # MODIFY: add checkBindingOperations()
scripts/capability-matrix/src/cli.ts              # MODIFY: wire operationId cross-check
schema/codegen.schema.json                        # MODIFY: templates optional + targets array
scripts/capability-matrix/package.json            # MODIFY: add normalize / generate / generate:check scripts
capabilities/storage.yaml                         # MODIFY: add bindings to a pilot subset of features
.gitignore                                        # MODIFY: ignore the generated package's .build/
```

---

### Task 1: Make `templates` optional and add `targets` to the codegen config

**Files:**
- Modify: `schema/codegen.schema.json`
- Modify: `scripts/capability-matrix/src/codegen.ts`
- Modify: `scripts/capability-matrix/src/generate.ts` (the `buildGenerateArgs` template handling)
- Test: `scripts/capability-matrix/test/codegen.test.ts`, `scripts/capability-matrix/test/generate.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/capability-matrix/test/codegen.test.ts` (inside the existing `describe("checkCodegenConfig", ...)`):

```ts
  it("accepts a language without templates (stock generator)", () => {
    const cfg = { ...valid, languages: { swift: { generator: "swift6" } } };
    expect(checkCodegenConfig(cfg, schema)).toEqual([]);
  });

  it("accepts an optional targets array", () => {
    const cfg = { ...valid, targets: [{ spec: "storage", language: "swift", output: "codegen/generated/swift-storage" }] };
    expect(checkCodegenConfig(cfg, schema)).toEqual([]);
  });

  it("rejects a target missing output", () => {
    const cfg = { ...valid, targets: [{ spec: "storage", language: "swift" }] };
    expect(checkCodegenConfig(cfg, schema).length).toBeGreaterThan(0);
  });
```

Append to `scripts/capability-matrix/test/generate.test.ts` (inside the existing `describe("buildGenerateArgs", ...)`):

```ts
  it("omits --template-dir when the language has no templates", () => {
    const stock: CodegenConfig = {
      engine: { tool: "openapi-generator", version: "7.23.0" },
      specs: { storage: { source: "codegen/specs/storage.normalized.json", version: "v1" } },
      languages: { swift: { generator: "swift6" } },
    };
    const args = buildGenerateArgs(stock, { spec: "storage", language: "swift", outDir: "out" });
    expect(args.includes("--template-dir")).toBe(false);
    expect(args).toEqual([
      "generate",
      "--input-spec", "codegen/specs/storage.normalized.json",
      "--generator-name", "swift6",
      "--output", "out",
    ]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd scripts/capability-matrix && npx vitest run test/codegen.test.ts test/generate.test.ts`
Expected: FAIL — the schema currently requires `templates`, has no `targets`, and `buildGenerateArgs` always emits `--template-dir`. (The "no templates" config currently fails schema validation, and `buildGenerateArgs` would throw or mis-emit.)

- [ ] **Step 3: Update the schema**

In `schema/codegen.schema.json`: under `languages`'s `additionalProperties`, change `"required": ["generator", "templates"]` to `"required": ["generator"]` (leave the `templates` and `generatorProperties` property definitions as-is — they remain optional). Then add a top-level optional `targets` property (sibling of `engine`/`specs`/`languages`):

```json
    "targets": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["spec", "language", "output"],
        "properties": {
          "spec": { "type": "string", "minLength": 1 },
          "language": { "type": "string", "minLength": 1 },
          "output": { "type": "string", "minLength": 1 }
        }
      }
    }
```

- [ ] **Step 4: Update the types**

In `scripts/capability-matrix/src/codegen.ts`: make `templates` optional on `LanguageConfig` and add the target type + optional `targets`:

```ts
export interface LanguageConfig {
  generator: string;
  templates?: string;
  generatorProperties?: Record<string, string>;
}

export interface GenerateTargetConfig {
  spec: string;
  language: string;
  output: string;
}

export interface CodegenConfig {
  engine: { tool: string; version: string };
  specs: Record<string, SpecSource>;
  languages: Record<string, LanguageConfig>;
  targets?: GenerateTargetConfig[];
}
```

- [ ] **Step 5: Make `buildGenerateArgs` emit `--template-dir` only when present**

In `scripts/capability-matrix/src/generate.ts`, replace the unconditional template-dir push. The arg array should be built as:

```ts
  const args = [
    "generate",
    "--input-spec", spec.source,
    "--generator-name", lang.generator,
    "--output", target.outDir,
  ];
  if (lang.templates) {
    args.push("--template-dir", lang.templates);
  }
```

(Keep the existing `generatorProperties` handling exactly as-is, after this block.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd scripts/capability-matrix && npx vitest run test/codegen.test.ts test/generate.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck, full suite, commit**

```bash
cd scripts/capability-matrix && npm run typecheck && npm test
```
Expected: clean typecheck, full suite green.

```bash
git add schema/codegen.schema.json scripts/capability-matrix/src/codegen.ts scripts/capability-matrix/src/generate.ts scripts/capability-matrix/test/codegen.test.ts scripts/capability-matrix/test/generate.test.ts
git commit -m "feat: make codegen templates optional and add generate targets"
```

---

### Task 2: Spec normalizer transforms

**Files:**
- Create: `scripts/capability-matrix/src/normalize.ts`
- Test: `scripts/capability-matrix/test/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/capability-matrix/test/normalize.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renameWildcardParams, renameSchemas, deriveOperationId, injectOperationIds, normalizeSpec } from "../src/normalize";

describe("renameWildcardParams", () => {
  it("renames {*} path keys and their `*` path params", () => {
    const spec: any = {
      paths: {
        "/cdn/{bucketName}/{*}": {
          delete: { parameters: [
            { in: "path", name: "bucketName", required: true, schema: { type: "string" } },
            { in: "path", name: "*", required: true, schema: { type: "string" } },
          ] },
        },
      },
    };
    renameWildcardParams(spec, "objectPath");
    expect(spec.paths["/cdn/{bucketName}/{*}"]).toBeUndefined();
    const op = spec.paths["/cdn/{bucketName}/{objectPath}"].delete;
    expect(op.parameters.find((p: any) => p.in === "path" && p.name === "objectPath")).toBeTruthy();
    expect(op.parameters.find((p: any) => p.name === "*")).toBeUndefined();
  });
});

describe("renameSchemas", () => {
  it("renames component schema keys and rewrites $refs", () => {
    const spec: any = {
      components: { schemas: { "def-1": { type: "object" } } },
      paths: { "/x": { get: { responses: { "4XX": { content: { "application/json": { schema: { $ref: "#/components/schemas/def-1" } } } } } } } },
    };
    renameSchemas(spec, { "def-1": "ErrorBody" });
    expect(spec.components.schemas["def-1"]).toBeUndefined();
    expect(spec.components.schemas["ErrorBody"]).toBeTruthy();
    expect(spec.paths["/x"].get.responses["4XX"].content["application/json"].schema.$ref).toBe("#/components/schemas/ErrorBody");
  });
});

describe("deriveOperationId", () => {
  it("derives a deterministic camelCase id", () => {
    expect(deriveOperationId("head", "/bucket")).toBe("headBucket");
    expect(deriveOperationId("get", "/bucket/{bucketId}")).toBe("getBucketByBucketId");
  });
});

describe("injectOperationIds", () => {
  it("injects derived ids, honors overrides, and keeps them unique", () => {
    const spec: any = {
      paths: {
        "/bucket": { get: {}, post: {} },
        "/object/{bucketName}/{objectPath}": { post: {} },
      },
    };
    injectOperationIds(spec, { "POST /object/{bucketName}/{objectPath}": "uploadObject" });
    expect(spec.paths["/bucket"].get.operationId).toBe("getBucket");
    expect(spec.paths["/bucket"].post.operationId).toBe("postBucket");
    expect(spec.paths["/object/{bucketName}/{objectPath}"].post.operationId).toBe("uploadObject");
  });

  it("does not overwrite an existing operationId", () => {
    const spec: any = { paths: { "/x": { get: { operationId: "keepMe" } } } };
    injectOperationIds(spec, {});
    expect(spec.paths["/x"].get.operationId).toBe("keepMe");
  });
});

describe("normalizeSpec", () => {
  it("applies wildcard rename, schema rename, then operationId injection (override keyed on normalized path)", () => {
    const spec: any = {
      components: { schemas: { "def-1": { type: "object" } } },
      paths: {
        "/object/{bucketName}/{*}": {
          post: { parameters: [
            { in: "path", name: "bucketName", required: true, schema: { type: "string" } },
            { in: "path", name: "*", required: true, schema: { type: "string" } },
          ], responses: { "4XX": { content: { "application/json": { schema: { $ref: "#/components/schemas/def-1" } } } } } },
        },
      },
    };
    normalizeSpec(spec, {
      schemaRenames: { "def-1": "ErrorBody" },
      operationIdOverrides: { "POST /object/{bucketName}/{objectPath}": "uploadObject" },
    });
    const op = spec.paths["/object/{bucketName}/{objectPath}"].post;
    expect(op.operationId).toBe("uploadObject");
    expect(op.parameters.some((p: any) => p.name === "objectPath")).toBe(true);
    expect(spec.components.schemas["ErrorBody"]).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd scripts/capability-matrix && npx vitest run test/normalize.test.ts`
Expected: FAIL — `../src/normalize` does not exist.

- [ ] **Step 3: Implement the normalizer**

Create `scripts/capability-matrix/src/normalize.ts`:

```ts
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

function camelCase(input: string): string {
  const words = input.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return words.map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1))).join("");
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

/** Deterministic, unique-ish id from method + path (params rendered as `by <name>`). */
export function deriveOperationId(method: string, path: string): string {
  const parts = path.split("/").filter(Boolean).map((seg) => {
    const m = seg.match(/^\{(.+)\}$/);
    return m ? `by ${m[1]}` : seg;
  });
  return camelCase([method, ...parts].join(" "));
}

/** Sets `operationId` on every operation lacking one (override map wins; guarantees uniqueness). */
export function injectOperationIds(spec: OpenApiDoc, overrides: Record<string, string> = {}): OpenApiDoc {
  const used = new Set<string>();
  const paths = spec.paths ?? {};
  // First pass: record ids that already exist so derived ones don't collide.
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd scripts/capability-matrix && npx vitest run test/normalize.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck, full suite, commit**

```bash
cd scripts/capability-matrix && npm run typecheck && npm test
git add scripts/capability-matrix/src/normalize.ts scripts/capability-matrix/test/normalize.test.ts
git commit -m "feat: add OpenAPI spec normalizer transforms"
```

---

### Task 3: Normalizer CLI + fetch and commit the Storage specs

**Files:**
- Create: `scripts/capability-matrix/src/normalize-cli.ts`
- Create: `codegen/normalize/storage.json`
- Create (fetched/generated): `codegen/specs/storage.upstream.json`, `codegen/specs/storage.normalized.json`
- Modify: `scripts/capability-matrix/package.json` (add `normalize` script)

- [ ] **Step 1: Write the normalize config**

Create `codegen/normalize/storage.json`:

```json
{
  "schemaRenames": {
    "def-0": "AuthHeader",
    "def-1": "ErrorBody"
  },
  "operationIdOverrides": {
    "POST /object/{bucketName}/{objectPath}": "uploadObject",
    "GET /bucket": "listBuckets",
    "POST /bucket": "createBucket"
  }
}
```

(These three overrides are confirmed-safe starting points. You will extend this map in Task 8 once you can read the full operationId list from the normalized spec.)

- [ ] **Step 2: Write the CLI**

Create `scripts/capability-matrix/src/normalize-cli.ts`:

```ts
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { normalizeSpec, type NormalizeOptions } from "./normalize";

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "..");
}

function main(): void {
  const root = repoRoot();
  // Usage: tsx src/normalize-cli.ts <input> <output> <config>
  // Defaults target the Storage pilot.
  const argv = process.argv.slice(2);
  const input = resolve(root, argv[0] ?? "codegen/specs/storage.upstream.json");
  const output = resolve(root, argv[1] ?? "codegen/specs/storage.normalized.json");
  const configPath = resolve(root, argv[2] ?? "codegen/normalize/storage.json");

  const spec = JSON.parse(readFileSync(input, "utf8"));
  const options = JSON.parse(readFileSync(configPath, "utf8")) as NormalizeOptions;
  normalizeSpec(spec, options);
  writeFileSync(output, JSON.stringify(spec, null, 2) + "\n");
  console.log(`normalized ${input} -> ${output}`);
}

main();
```

- [ ] **Step 3: Add the npm script**

In `scripts/capability-matrix/package.json` `scripts`, add:
```json
    "normalize": "tsx src/normalize-cli.ts",
```

- [ ] **Step 4: Fetch the pinned upstream spec and produce the normalized spec**

From the repo root:
```bash
mkdir -p codegen/specs
curl -sS --fail "https://raw.githubusercontent.com/supabase/storage/53e6a743d5b02e7e7e7b7549f7490517773be016/api.json" -o codegen/specs/storage.upstream.json
cd scripts/capability-matrix && npm run normalize
```
Expected: `codegen/specs/storage.normalized.json` is written.

- [ ] **Step 5: Verify the normalization actually fixed the spec**

From the repo root, confirm the three issues are resolved (these should all print `0`, then a positive count):
```bash
echo "remaining {*} paths: $(grep -c '{\*}' codegen/specs/storage.normalized.json)"
echo "remaining def- schemas: $(grep -c '"def-' codegen/specs/storage.normalized.json)"
node -e "const s=require('./codegen/specs/storage.normalized.json');const ids=Object.values(s.paths).flatMap(p=>Object.entries(p).filter(([k])=>['get','put','post','delete','patch','head','options'].includes(k)).map(([,o])=>o.operationId));console.log('operations:',ids.length,'withId:',ids.filter(Boolean).length,'unique:',new Set(ids).size)"
```
Expected: `remaining {*} paths: 0`, `remaining def- schemas: 0`, and `operations`, `withId`, and `unique` are all equal (108, 108, 108).

- [ ] **Step 6: Commit**

```bash
git add codegen/normalize/storage.json codegen/specs/storage.upstream.json codegen/specs/storage.normalized.json scripts/capability-matrix/src/normalize-cli.ts scripts/capability-matrix/package.json
git commit -m "feat: normalize and commit the Storage OpenAPI spec"
```

---

### Task 4: Author `codegen.yaml`

**Files:**
- Create: `codegen.yaml` (repo root)

- [ ] **Step 1: Write the config**

Create `codegen.yaml` at the repo root:

```yaml
# yaml-language-server: $schema=./schema/codegen.schema.json
engine:
  tool: openapi-generator
  version: "7.23.0"

specs:
  storage:
    source: codegen/specs/storage.normalized.json
    version: "gh-pages@53e6a743d5b02e7e7e7b7549f7490517773be016"

languages:
  swift:
    generator: swift6
    generatorProperties:
      projectName: SupabaseStorage
      responseAs: AsyncAwait
      library: urlsession
      useSPMFileStructure: "true"
      nonPublicApi: "true"

targets:
  - spec: storage
    language: swift
    output: codegen/generated/swift-storage
```

- [ ] **Step 2: Verify it validates**

From the repo root:
```bash
cd scripts/capability-matrix && npm run validate
```
Expected: `OK — capability matrix is valid.` (The codegen branch now runs because `codegen.yaml` exists; it must pass `checkCodegenConfig`. There are no feature bindings yet, so `checkBindings` is a no-op.)

- [ ] **Step 3: Commit**

```bash
git add codegen.yaml
git commit -m "feat: add codegen.yaml for the Swift Storage pilot"
```

---

### Task 5: Generation runner + CLI

**Files:**
- Modify: `scripts/capability-matrix/src/generate.ts` (add `runGenerate`)
- Create: `scripts/capability-matrix/src/generate-cli.ts`
- Modify: `scripts/capability-matrix/package.json` (add `generate` script)

- [ ] **Step 1: Add `runGenerate` to `src/generate.ts`**

Append to `scripts/capability-matrix/src/generate.ts`:

```ts
import { spawnSync } from "node:child_process";

export interface RunGenerateOptions {
  cwd: string;
  bin?: string;
  stdio?: "inherit" | "pipe";
}

/** Spawns openapi-generator with the args from buildGenerateArgs. Throws on non-zero exit. */
export function runGenerate(config: CodegenConfig, target: GenerateTarget, opts: RunGenerateOptions): void {
  const args = buildGenerateArgs(config, target);
  const bin = opts.bin ?? "openapi-generator";
  const res = spawnSync(bin, args, { cwd: opts.cwd, stdio: opts.stdio ?? "inherit" });
  if (res.error) throw new Error(`failed to spawn ${bin}: ${res.error.message}`);
  if (res.status !== 0) throw new Error(`${bin} ${args.join(" ")} exited with status ${res.status}`);
}
```

(Keep the existing `buildGenerateArgs` and `GenerateTarget` exports. The `import { spawnSync }` line goes with the other imports at the top of the file.)

- [ ] **Step 2: Write the CLI**

Create `scripts/capability-matrix/src/generate-cli.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { loadCodegenConfig } from "./codegen";
import { runGenerate } from "./generate";

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "..");
}

function main(): void {
  const root = repoRoot();
  const { config, findings } = loadCodegenConfig(join(root, "codegen.yaml"));
  if (!config) {
    for (const f of findings) console.error(`ERROR ${f.file}: ${f.message}`);
    process.exit(1);
  }
  const targets = config.targets ?? [];
  if (targets.length === 0) {
    console.log("no targets declared in codegen.yaml");
    return;
  }
  for (const t of targets) {
    console.log(`generating ${t.spec} -> ${t.language} into ${t.output}`);
    // Paths in codegen.yaml are repo-root relative; run with cwd=root so they resolve.
    runGenerate(config, { spec: t.spec, language: t.language, outDir: t.output }, { cwd: root });
  }
}

main();
```

- [ ] **Step 3: Add the npm script**

In `scripts/capability-matrix/package.json` `scripts`, add:
```json
    "generate": "tsx src/generate-cli.ts",
```

- [ ] **Step 4: Typecheck and commit (no generation run yet)**

```bash
cd scripts/capability-matrix && npm run typecheck && npm test
git add scripts/capability-matrix/src/generate.ts scripts/capability-matrix/src/generate-cli.ts scripts/capability-matrix/package.json
git commit -m "feat: add openapi-generator runner and generate CLI"
```

---

### Task 6: Generate the Swift package and verify it builds

**Files:**
- Create (generated, committed): `codegen/generated/swift-storage/`
- Modify: `.gitignore`

- [ ] **Step 1: Ignore the Swift build directory**

Add to `.gitignore` (create the file if it does not exist; check first):
```
codegen/generated/**/.build/
```

- [ ] **Step 2: Generate**

From the repo root:
```bash
cd scripts/capability-matrix && npm run generate
```
Expected: `openapi-generator` runs and writes `codegen/generated/swift-storage/` containing `Package.swift` and `Sources/SupabaseStorage/{Models,APIs,Infrastructure}/`. No errors.

- [ ] **Step 3: Build the generated package**

From the repo root:
```bash
cd codegen/generated/swift-storage && swift build 2>&1 | tail -20
```
Expected: `Build complete!` (the normalized spec removed the `{*}` wildcards that previously caused ~2,269 compile errors). If the build fails, capture the errors and STOP — report as BLOCKED with the specific errors; do not commit a non-building package.

- [ ] **Step 4: Commit the generated package**

```bash
git add .gitignore codegen/generated/swift-storage
git commit -m "feat: generate and commit the Swift Storage core (builds clean)"
```

---

### Task 7: Drift guard

**Files:**
- Modify: `scripts/capability-matrix/package.json` (add `generate:check`)

- [ ] **Step 1: Add the drift-check script**

In `scripts/capability-matrix/package.json` `scripts`, add (the `git -C ../..` targets the repo root from this package dir):
```json
    "generate:check": "npm run normalize && npm run generate && git -C ../.. diff --exit-code -- codegen/specs/storage.normalized.json codegen/generated/swift-storage",
```

- [ ] **Step 2: Verify regeneration is deterministic (no diff)**

From the repo root:
```bash
cd scripts/capability-matrix && npm run generate:check
```
Expected: exits 0 with no diff — regenerating the normalized spec and the Swift package reproduces exactly what is committed. If there is a diff, the generation is non-deterministic; STOP and report the diff (a common cause is an unpinned input or a timestamp in generated output — if openapi-generator writes a timestamp, add that file to `.openapi-generator-ignore` in the output and regenerate before committing).

- [ ] **Step 3: Commit**

```bash
git add scripts/capability-matrix/package.json
git commit -m "feat: add generate:check drift guard"
```

---

### Task 8: Cross-validate binding operationIds and bind the pilot subset

**Files:**
- Modify: `scripts/capability-matrix/src/bindings.ts` (add `checkBindingOperations`)
- Modify: `scripts/capability-matrix/src/cli.ts` (wire it in)
- Modify: `codegen/normalize/storage.json` (extend overrides for the bound subset) and regenerate
- Modify: `capabilities/storage.yaml` (add bindings)
- Test: `scripts/capability-matrix/test/bindings.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `scripts/capability-matrix/test/bindings.test.ts`:

```ts
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkBindingOperations } from "../src/bindings";

describe("checkBindingOperations", () => {
  function specDir(operationIds: string[]): string {
    const dir = mkdtempSync(join(tmpdir(), "spec-"));
    const paths: any = {};
    operationIds.forEach((id, i) => { paths[`/op${i}`] = { get: { operationId: id } }; });
    writeFileSync(join(dir, "storage.normalized.json"), JSON.stringify({ openapi: "3.0.3", paths }));
    return dir;
  }
  const cfg: any = {
    engine: { tool: "openapi-generator", version: "7.23.0" },
    specs: { storage: { source: "storage.normalized.json", version: "v1" } },
    languages: { swift: { generator: "swift6" } },
  };
  function area(features: unknown[]): LoadedArea {
    return { file: "/x/storage.yaml", area: { area: "storage", title: "T", description: "d", features: features as never } };
  }

  it("passes when a binding's operationId exists in the spec", () => {
    const base = specDir(["uploadObject"]);
    const a = area([{ id: "storage.x.upload", name: "U", description: "d", binding: { spec: "storage", operationId: "uploadObject" } }]);
    expect(checkBindingOperations([a], cfg, base)).toEqual([]);
  });

  it("errors when the operationId is not in the spec", () => {
    const base = specDir(["uploadObject"]);
    const a = area([{ id: "storage.x.ghost", name: "G", description: "d", binding: { spec: "storage", operationId: "ghostOp" } }]);
    const findings = checkBindingOperations([a], cfg, base);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("ghostOp");
  });

  it("ignores features without a binding", () => {
    const base = specDir(["uploadObject"]);
    const a = area([{ id: "storage.x.none", name: "N", description: "d" }]);
    expect(checkBindingOperations([a], cfg, base)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd scripts/capability-matrix && npx vitest run test/bindings.test.ts`
Expected: FAIL — `checkBindingOperations` does not exist.

- [ ] **Step 3: Implement `checkBindingOperations`**

Append to `scripts/capability-matrix/src/bindings.ts` (the existing `import type` lines stay; add `readFileSync` + `path` imports):

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HTTP_METHODS = ["get", "put", "post", "delete", "patch", "head", "options"];

function specOperationIds(file: string): Set<string> {
  const doc = JSON.parse(readFileSync(file, "utf8")) as Record<string, any>;
  const ids = new Set<string>();
  for (const item of Object.values(doc.paths ?? {})) {
    for (const m of HTTP_METHODS) {
      const op = (item as any)?.[m];
      if (op?.operationId) ids.add(op.operationId);
    }
  }
  return ids;
}

/**
 * Verifies each feature binding's operationId exists in its referenced spec.
 * `baseDir` is the directory codegen.yaml lives in (spec.source is relative to it).
 */
export function checkBindingOperations(loaded: LoadedArea[], config: CodegenConfig, baseDir: string): Finding[] {
  const findings: Finding[] = [];
  const cache = new Map<string, Set<string>>();
  for (const { file, area } of loaded) {
    for (const feature of area?.features ?? []) {
      const binding = feature.binding;
      if (!binding) continue;
      const spec = config.specs[binding.spec];
      if (!spec) continue; // unknown spec already reported by checkBindings
      const specFile = resolve(baseDir, spec.source);
      let ids = cache.get(specFile);
      if (!ids) {
        try {
          ids = specOperationIds(specFile);
        } catch (e) {
          findings.push({ level: "error", file, message: `cannot read spec "${spec.source}" for operationId check: ${(e as Error).message}` });
          ids = new Set();
        }
        cache.set(specFile, ids);
      }
      if (!ids.has(binding.operationId)) {
        findings.push({ level: "error", file, message: `feature "${feature.id}" binds to operationId "${binding.operationId}" not present in spec "${binding.spec}"` });
      }
    }
  }
  return findings;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd scripts/capability-matrix && npx vitest run test/bindings.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the cross-check into `run()`**

In `scripts/capability-matrix/src/cli.ts`: import `checkBindingOperations` from `./bindings`, import `dirname` from `node:path` (add to the existing `node:path` import), and inside the codegen branch — immediately after `findings.push(...checkBindings(areas, config))` — add:

```ts
      findings.push(...checkBindingOperations(areas, config, dirname(opts.codegenConfigPath)));
```

- [ ] **Step 6: Choose the pilot subset and finalize operationIds**

List the available operationIds and pick ~5 storage features to bind:
```bash
node -e "const s=require('./codegen/specs/storage.normalized.json');for(const [p,item] of Object.entries(s.paths))for(const m of ['get','put','post','delete','patch','head','options'])if(item[m])console.log(item[m].operationId,'  <-',m.toUpperCase(),p)" | sort
```
Pick 5 features that exist in `capabilities/storage.yaml` and map cleanly to an operation (e.g. create file bucket, list buckets, upload object, plus two more you can confidently identify from the path list). For any whose derived id is ugly, add a readable override to `codegen/normalize/storage.json` `operationIdOverrides` (keyed `"METHOD /normalized/path"`). If you change overrides, regenerate: `cd scripts/capability-matrix && npm run generate:check` must still pass after re-committing the regenerated specs/package (run `npm run normalize && npm run generate`, then re-commit `codegen/`).

- [ ] **Step 7: Add bindings to `capabilities/storage.yaml`**

For each chosen feature, add a `binding` (keep existing `id`/`name`/`description`/`group`). Example shape (use the real operationIds from Step 6):

```yaml
  - id: storage.file_buckets.create_file_bucket
    name: Create File Bucket
    description: Create a new file storage bucket.
    group: file_buckets
    binding:
      spec: storage
      operationId: createBucket
```

- [ ] **Step 8: Validate**

```bash
cd scripts/capability-matrix && npm run validate
```
Expected: `OK — capability matrix is valid.` — every binding references the `storage` spec (declared in `codegen.yaml`) and an operationId that exists in the normalized spec. To prove the cross-check bites, temporarily change one binding's `operationId` to `nope`, run validate (expect an error naming `nope`), then revert.

- [ ] **Step 9: Full suite, typecheck, commit**

```bash
cd scripts/capability-matrix && npm test && npm run typecheck
git add scripts/capability-matrix/src/bindings.ts scripts/capability-matrix/src/cli.ts scripts/capability-matrix/test/bindings.test.ts capabilities/storage.yaml codegen/normalize/storage.json codegen/specs/storage.normalized.json codegen/generated/swift-storage
git commit -m "feat: cross-check binding operationIds and bind the Storage pilot subset"
```

---

## Out of scope (Plan 3)

- Hand-written `StorageClient` surface over the generated core (the public ergonomics layer).
- Conformance vectors executed as Swift tests proving behavior.
- A CI workflow running `generate:check` + `swift build` on PRs (this plan adds the npm scripts; wiring them into `.github/workflows` is Plan 3).
- Custom `templates/swift/` overrides (stock `swift6` + `nonPublicApi` is the Plan 2 baseline; revisit only if ergonomics demand it).
- Moving the pilot out to the supabase-swift repo (deferred until the in-repo slice is finalized).

## Self-review notes

- **Spec coverage:** normalizer (design §6.1) → Tasks 2, 3; deterministic committed specs → Task 3; codegen.yaml + stock-template generation (§6/§8) → Tasks 1, 4, 5; committed generated code that builds (§5/§11) → Task 6; drift guard (§8) → Task 7; binding→operation enforcement / "no honor system" (§6) → Task 8. Hand-written surface + conformance (§9/§11) explicitly deferred to Plan 3.
- **Type consistency:** `LanguageConfig.templates?`, `GenerateTargetConfig {spec,language,output}`, `CodegenConfig.targets?`, `runGenerate(config, target, {cwd,bin,stdio})`, `checkBindingOperations(loaded, config, baseDir)`, and the normalizer exports (`renameWildcardParams`, `renameSchemas`, `deriveOperationId`, `injectOperationIds`, `normalizeSpec`) are used identically across tasks and tests.
- **No placeholders:** authored code (Tasks 1, 2, 8) is complete; generation/build/drift steps (Tasks 3–7) are exact commands with expected output. The only deliberately deferred specifics are the final pilot operationId picks (Task 8 Step 6), which depend on reading the generated operationId list and are bounded by an explicit procedure.
- **Determinism risk:** Task 7 is the guard; if openapi-generator emits a timestamp/version stamp, Task 7 Step 2 documents the `.openapi-generator-ignore` fix.
