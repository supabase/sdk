# SDK codegen foundation implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the central code-generation contract to `supabase/sdk` — the `binding` field, the `codegen.yaml` config, the generator-args builder, and the conformance-vector format — all validated by the existing matrix validator.

**Architecture:** Extend the existing TypeScript validator (`scripts/capability-matrix`) additively. Features gain an optional `binding: { spec, operationId }`. A new `codegen.yaml` (validated by a new JSON schema) declares the pinned engine, spec sources, and per-language template packs. A pure `buildGenerateArgs()` turns that config into an `openapi-generator` command line. A new conformance-vector format (validated by a new JSON schema) defines language-agnostic test cases. All checks plug into the existing `run()` so `npm run validate` enforces them. No code is generated in this plan — this is the contract and tooling the per-language plans consume.

**Tech Stack:** TypeScript (ESM), `tsx`, `vitest`, `ajv`/`ajv-formats` (JSON Schema 2020-12), `yaml`. All already present in `scripts/capability-matrix/package.json`. `openapi-generator` itself is a downstream dependency introduced in the Swift plan, not here.

**Scope / decomposition:** This is plan 1 of 3 for the Storage pilot. Plan 2 (Swift template pack) and plan 3 (supabase-swift `StorageGen` module) live in the spec at `docs/design/2026-06-16-sdk-code-generation-design.md` and are gated on a discovery spike (running `openapi-generator` against the real Storage spec). This plan delivers working, tested software on its own: the validator enforces bindings, codegen config, and conformance vectors, with fixtures standing in for the real Storage spec.

**Conventions to follow (from the existing code):**
- ESM imports with **no file extension** (`import { x } from "./types"`) — matches `cli.ts`, `load.ts`, `schema.ts`, and the tests.
- All checks return `Finding[]` (`{ level: "error" | "warning"; file: string; message: string }`).
- Schema validation goes through `compileSchema()` from `src/schema.ts`.
- Tests use `vitest` with `mkdtempSync`/`tmpdir` for file-based cases — mirror `test/structural.test.ts`.
- Run a single test file with: `cd scripts/capability-matrix && npx vitest run test/<file>.test.ts`.

---

### Task 1: Add the `binding` field to features (types + schema)

**Files:**
- Modify: `scripts/capability-matrix/src/types.ts:25-30`
- Modify: `schema/capability-matrix.schema.json:30-45`
- Test: `scripts/capability-matrix/test/binding-schema.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/capability-matrix/test/binding-schema.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { checkSchema } from "../src/schema";
import type { LoadedArea } from "../src/types";

const schema = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "schema", "capability-matrix.schema.json"),
    "utf8",
  ),
);

function area(features: unknown[]): LoadedArea {
  return { file: "/x/storage.yaml", area: { area: "storage", title: "T", description: "d", features: features as never } };
}

describe("feature binding schema", () => {
  it("accepts a feature with a valid binding", () => {
    const a = area([
      { id: "storage.objects.upload", name: "Upload", description: "d", binding: { spec: "storage", operationId: "uploadObject" } },
    ]);
    expect(checkSchema([a], schema)).toEqual([]);
  });

  it("rejects a binding missing operationId", () => {
    const a = area([
      { id: "storage.objects.upload", name: "Upload", description: "d", binding: { spec: "storage" } },
    ]);
    expect(checkSchema([a], schema).length).toBeGreaterThan(0);
  });

  it("rejects a binding with an unknown property", () => {
    const a = area([
      { id: "storage.objects.upload", name: "Upload", description: "d", binding: { spec: "storage", operationId: "uploadObject", extra: true } },
    ]);
    expect(checkSchema([a], schema).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/capability-matrix && npx vitest run test/binding-schema.test.ts`
Expected: FAIL — the first case errors because `additionalProperties: false` on the feature currently rejects the unknown `binding` key.

- [ ] **Step 3: Add the `Binding` type and extend `Feature`**

In `scripts/capability-matrix/src/types.ts`, replace the `Feature` interface (lines 25-30):

```ts
export interface Binding {
  spec: string;
  operationId: string;
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  group?: string;
  binding?: Binding;
}
```

- [ ] **Step 4: Add `binding` to the JSON schema**

In `schema/capability-matrix.schema.json`, add `binding` to the feature's `properties` (after the `group` property, line 43), and add a `binding` definition under `$defs`:

```json
        "group": { "type": "string", "minLength": 1 },
        "binding": { "$ref": "#/$defs/binding" }
```

```json
  "$defs": {
    "feature": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "name", "description"],
      "properties": {
        "id": {
          "type": "string",
          "description": "Three-segment dotted id: <area>.<group_namespace>.<method_stem>. Example: auth.mfa.challenge",
          "pattern": "^[a-z][a-z0-9_]*\\.[a-z0-9_]+\\.[a-z0-9_]+$"
        },
        "name": { "type": "string", "minLength": 1 },
        "description": { "type": "string", "minLength": 1 },
        "group": { "type": "string", "minLength": 1 },
        "binding": { "$ref": "#/$defs/binding" }
      }
    },
    "binding": {
      "type": "object",
      "additionalProperties": false,
      "required": ["spec", "operationId"],
      "properties": {
        "spec": { "type": "string", "minLength": 1, "description": "Spec id declared in codegen.yaml" },
        "operationId": { "type": "string", "minLength": 1, "description": "OpenAPI operationId this feature maps to" }
      }
    }
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd scripts/capability-matrix && npx vitest run test/binding-schema.test.ts`
Expected: PASS (all three cases).

- [ ] **Step 6: Typecheck and commit**

Run: `cd scripts/capability-matrix && npm run typecheck`
Expected: no errors.

```bash
git add scripts/capability-matrix/src/types.ts schema/capability-matrix.schema.json scripts/capability-matrix/test/binding-schema.test.ts
git commit -m "feat: add optional binding field to capability features"
```

---

### Task 2: Add the `codegen.yaml` schema, types, and loader

**Files:**
- Create: `schema/codegen.schema.json`
- Create: `scripts/capability-matrix/src/codegen.ts`
- Test: `scripts/capability-matrix/test/codegen.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/capability-matrix/test/codegen.test.ts`:

```ts
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { loadCodegenConfig, checkCodegenConfig } from "../src/codegen";

const schema = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "schema", "codegen.schema.json"),
    "utf8",
  ),
);

const valid = {
  engine: { tool: "openapi-generator", version: "7.10.0" },
  specs: { storage: { source: "https://example.com/storage.yaml", version: "v1.2.3" } },
  languages: { swift: { generator: "swift5", templates: "templates/swift" } },
};

describe("checkCodegenConfig", () => {
  it("accepts a valid config", () => {
    expect(checkCodegenConfig(valid, schema)).toEqual([]);
  });

  it("rejects a config missing engine.version", () => {
    const bad = { ...valid, engine: { tool: "openapi-generator" } };
    expect(checkCodegenConfig(bad, schema).length).toBeGreaterThan(0);
  });

  it("rejects a language missing its generator", () => {
    const bad = { ...valid, languages: { swift: { templates: "templates/swift" } } };
    expect(checkCodegenConfig(bad, schema).length).toBeGreaterThan(0);
  });
});

describe("loadCodegenConfig", () => {
  it("parses a YAML config file", () => {
    const dir = mkdtempSync(join(tmpdir(), "codegen-"));
    const file = join(dir, "codegen.yaml");
    writeFileSync(file, "engine:\n  tool: openapi-generator\n  version: 7.10.0\nspecs:\n  storage:\n    source: x\n    version: v1\nlanguages:\n  swift:\n    generator: swift5\n    templates: templates/swift\n");
    const { config, findings } = loadCodegenConfig(file);
    expect(findings).toEqual([]);
    expect(config?.engine.version).toBe("7.10.0");
    expect(config?.specs.storage.source).toBe("x");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/capability-matrix && npx vitest run test/codegen.test.ts`
Expected: FAIL — `../src/codegen` and `schema/codegen.schema.json` do not exist yet.

- [ ] **Step 3: Create the codegen schema**

Create `schema/codegen.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://supabase.com/sdk/codegen.schema.json",
  "title": "Supabase SDK codegen config",
  "type": "object",
  "additionalProperties": false,
  "required": ["engine", "specs", "languages"],
  "properties": {
    "engine": {
      "type": "object",
      "additionalProperties": false,
      "required": ["tool", "version"],
      "properties": {
        "tool": { "type": "string", "minLength": 1 },
        "version": { "type": "string", "minLength": 1 }
      }
    },
    "specs": {
      "type": "object",
      "minProperties": 1,
      "additionalProperties": {
        "type": "object",
        "additionalProperties": false,
        "required": ["source", "version"],
        "properties": {
          "source": { "type": "string", "minLength": 1 },
          "version": { "type": "string", "minLength": 1 }
        }
      }
    },
    "languages": {
      "type": "object",
      "minProperties": 1,
      "additionalProperties": {
        "type": "object",
        "additionalProperties": false,
        "required": ["generator", "templates"],
        "properties": {
          "generator": { "type": "string", "minLength": 1 },
          "templates": { "type": "string", "minLength": 1 },
          "generatorProperties": {
            "type": "object",
            "additionalProperties": { "type": "string" }
          }
        }
      }
    }
  }
}
```

- [ ] **Step 4: Create the loader and validator**

Create `scripts/capability-matrix/src/codegen.ts`:

```ts
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { compileSchema } from "./schema";
import type { Finding } from "./types";

export interface SpecSource {
  source: string;
  version: string;
}

export interface LanguageConfig {
  generator: string;
  templates: string;
  generatorProperties?: Record<string, string>;
}

export interface CodegenConfig {
  engine: { tool: string; version: string };
  specs: Record<string, SpecSource>;
  languages: Record<string, LanguageConfig>;
}

export function loadCodegenConfig(file: string): { config?: CodegenConfig; findings: Finding[] } {
  try {
    const config = parse(readFileSync(file, "utf8")) as CodegenConfig;
    return { config, findings: [] };
  } catch (e) {
    return { findings: [{ level: "error", file, message: `codegen config parse error: ${(e as Error).message}` }] };
  }
}

export function checkCodegenConfig(config: unknown, schema: object, file = "codegen.yaml"): Finding[] {
  const validate = compileSchema(schema);
  if (validate(config)) return [];
  return (validate.errors ?? []).map((err) => ({
    level: "error" as const,
    file,
    message: `codegen schema: ${err.instancePath || "/"} ${err.message ?? "invalid"}`,
  }));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd scripts/capability-matrix && npx vitest run test/codegen.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck and commit**

Run: `cd scripts/capability-matrix && npm run typecheck`
Expected: no errors.

```bash
git add schema/codegen.schema.json scripts/capability-matrix/src/codegen.ts scripts/capability-matrix/test/codegen.test.ts
git commit -m "feat: add codegen.yaml schema, types, and loader"
```

---

### Task 3: Cross-validate feature bindings against the codegen config

**Files:**
- Create: `scripts/capability-matrix/src/bindings.ts`
- Test: `scripts/capability-matrix/test/bindings.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/capability-matrix/test/bindings.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { checkBindings } from "../src/bindings";
import type { LoadedArea } from "../src/types";
import type { CodegenConfig } from "../src/codegen";

const config: CodegenConfig = {
  engine: { tool: "openapi-generator", version: "7.10.0" },
  specs: { storage: { source: "x", version: "v1" } },
  languages: { swift: { generator: "swift5", templates: "templates/swift" } },
};

function area(features: unknown[]): LoadedArea {
  return { file: "/x/storage.yaml", area: { area: "storage", title: "T", description: "d", features: features as never } };
}

describe("checkBindings", () => {
  it("passes when a binding references a known spec", () => {
    const a = area([
      { id: "storage.objects.upload", name: "U", description: "d", binding: { spec: "storage", operationId: "uploadObject" } },
    ]);
    expect(checkBindings([a], config)).toEqual([]);
  });

  it("ignores features without a binding", () => {
    const a = area([{ id: "storage.objects.upload", name: "U", description: "d" }]);
    expect(checkBindings([a], config)).toEqual([]);
  });

  it("errors when a binding references an unknown spec", () => {
    const a = area([
      { id: "storage.objects.upload", name: "U", description: "d", binding: { spec: "ghost", operationId: "x" } },
    ]);
    const findings = checkBindings([a], config);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('unknown spec "ghost"');
  });
});
```

Note: `LoadedArea` comes from `../src/types`; `CodegenConfig` comes from `../src/codegen` (added in Task 2).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/capability-matrix && npx vitest run test/bindings.test.ts`
Expected: FAIL — `../src/bindings` does not exist.

- [ ] **Step 3: Create the binding checker**

Create `scripts/capability-matrix/src/bindings.ts`:

```ts
import type { CodegenConfig } from "./codegen";
import type { Finding, LoadedArea } from "./types";

export function checkBindings(loaded: LoadedArea[], config: CodegenConfig): Finding[] {
  const findings: Finding[] = [];
  for (const { file, area } of loaded) {
    for (const feature of area?.features ?? []) {
      const binding = feature.binding;
      if (!binding) continue;
      if (!config.specs[binding.spec]) {
        findings.push({
          level: "error",
          file,
          message: `feature "${feature.id}" binds to unknown spec "${binding.spec}" (not declared in codegen config)`,
        });
      }
    }
  }
  return findings;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scripts/capability-matrix && npx vitest run test/bindings.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

Run: `cd scripts/capability-matrix && npm run typecheck`
Expected: no errors.

```bash
git add scripts/capability-matrix/src/bindings.ts scripts/capability-matrix/test/bindings.test.ts
git commit -m "feat: validate feature bindings against codegen config"
```

---

### Task 4: Build the openapi-generator argument builder

**Files:**
- Create: `scripts/capability-matrix/src/generate.ts`
- Test: `scripts/capability-matrix/test/generate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/capability-matrix/test/generate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildGenerateArgs } from "../src/generate";
import type { CodegenConfig } from "../src/codegen";

const config: CodegenConfig = {
  engine: { tool: "openapi-generator", version: "7.10.0" },
  specs: { storage: { source: "https://example.com/storage.yaml", version: "v1" } },
  languages: {
    swift: { generator: "swift5", templates: "templates/swift", generatorProperties: { library: "urlsession", useJsonEncodable: "false" } },
  },
};

describe("buildGenerateArgs", () => {
  it("builds the generate command for a target", () => {
    const args = buildGenerateArgs(config, { spec: "storage", language: "swift", outDir: "generated/storage" });
    expect(args).toEqual([
      "generate",
      "--input-spec", "https://example.com/storage.yaml",
      "--generator-name", "swift5",
      "--output", "generated/storage",
      "--template-dir", "templates/swift",
      "--additional-properties=library=urlsession,useJsonEncodable=false",
    ]);
  });

  it("omits --additional-properties when there are none", () => {
    const bare: CodegenConfig = { ...config, languages: { swift: { generator: "swift5", templates: "templates/swift" } } };
    const args = buildGenerateArgs(bare, { spec: "storage", language: "swift", outDir: "out" });
    expect(args).not.toContain("--additional-properties");
    expect(args.some((a) => a.startsWith("--additional-properties"))).toBe(false);
  });

  it("throws on an unknown spec", () => {
    expect(() => buildGenerateArgs(config, { spec: "ghost", language: "swift", outDir: "out" })).toThrow(/unknown spec/);
  });

  it("throws on an unknown language", () => {
    expect(() => buildGenerateArgs(config, { spec: "storage", language: "cobol", outDir: "out" })).toThrow(/unknown language/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/capability-matrix && npx vitest run test/generate.test.ts`
Expected: FAIL — `../src/generate` does not exist.

- [ ] **Step 3: Create the argument builder**

Create `scripts/capability-matrix/src/generate.ts`:

```ts
import type { CodegenConfig } from "./codegen";

export interface GenerateTarget {
  spec: string;
  language: string;
  outDir: string;
}

/**
 * Builds the argv for `openapi-generator-cli generate` from the codegen config
 * and a target. Pure function — the engine version pin is applied by the
 * openapi-generator-cli toolchain (openapitools.json), not here.
 */
export function buildGenerateArgs(config: CodegenConfig, target: GenerateTarget): string[] {
  const spec = config.specs[target.spec];
  if (!spec) throw new Error(`unknown spec "${target.spec}" (not declared in codegen config)`);
  const lang = config.languages[target.language];
  if (!lang) throw new Error(`unknown language "${target.language}" (not declared in codegen config)`);

  const args = [
    "generate",
    "--input-spec", spec.source,
    "--generator-name", lang.generator,
    "--output", target.outDir,
    "--template-dir", lang.templates,
  ];

  const extra = lang.generatorProperties;
  if (extra && Object.keys(extra).length > 0) {
    const pairs = Object.entries(extra).map(([k, v]) => `${k}=${v}`).join(",");
    args.push(`--additional-properties=${pairs}`);
  }

  return args;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scripts/capability-matrix && npx vitest run test/generate.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

Run: `cd scripts/capability-matrix && npm run typecheck`
Expected: no errors.

```bash
git add scripts/capability-matrix/src/generate.ts scripts/capability-matrix/test/generate.test.ts
git commit -m "feat: add openapi-generator argument builder"
```

---

### Task 5: Add the conformance-vector format and validator

**Files:**
- Create: `schema/conformance.schema.json`
- Create: `scripts/capability-matrix/src/conformance.ts`
- Test: `scripts/capability-matrix/test/conformance.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/capability-matrix/test/conformance.test.ts`:

```ts
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { checkConformance } from "../src/conformance";

const schema = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "schema", "conformance.schema.json"),
    "utf8",
  ),
);

function makeDir(files: Record<string, string>): string {
  const tmp = mkdtempSync(join(tmpdir(), "conf-"));
  for (const [rel, content] of Object.entries(files)) {
    const parts = rel.split("/");
    if (parts.length > 1) mkdirSync(join(tmp, ...parts.slice(0, -1)), { recursive: true });
    writeFileSync(join(tmp, rel), content);
  }
  return tmp;
}

const validVector = "feature: storage.objects.upload\ncases:\n  - name: uploads a small file\n    input: { path: a.txt, body: hi }\n    expected: { status: 200 }\n";

describe("checkConformance", () => {
  it("passes when a vector is well-formed and references a known feature", () => {
    const dir = makeDir({ "storage/upload.yaml": validVector });
    expect(checkConformance(dir, new Set(["storage.objects.upload"]), schema)).toEqual([]);
  });

  it("errors when a vector references an unknown feature", () => {
    const dir = makeDir({ "storage/upload.yaml": validVector });
    const findings = checkConformance(dir, new Set(["storage.objects.list"]), schema);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("storage.objects.upload");
  });

  it("errors when a vector is malformed (missing cases)", () => {
    const dir = makeDir({ "storage/bad.yaml": "feature: storage.objects.upload\n" });
    expect(checkConformance(dir, new Set(["storage.objects.upload"]), schema).length).toBeGreaterThan(0);
  });

  it("returns empty when the conformance directory does not exist", () => {
    expect(checkConformance("/nonexistent/conf-xyzzy", new Set(), schema)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/capability-matrix && npx vitest run test/conformance.test.ts`
Expected: FAIL — `../src/conformance` and `schema/conformance.schema.json` do not exist yet.

- [ ] **Step 3: Create the conformance schema**

Create `schema/conformance.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://supabase.com/sdk/conformance.schema.json",
  "title": "Supabase SDK conformance vector file",
  "type": "object",
  "additionalProperties": false,
  "required": ["feature", "cases"],
  "properties": {
    "feature": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_]*\\.[a-z0-9_]+\\.[a-z0-9_]+$"
    },
    "cases": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["name", "input", "expected"],
        "properties": {
          "name": { "type": "string", "minLength": 1 },
          "input": {},
          "expected": {}
        }
      }
    }
  }
}
```

- [ ] **Step 4: Create the conformance loader/validator**

Create `scripts/capability-matrix/src/conformance.ts`:

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { compileSchema } from "./schema";
import type { Finding } from "./types";

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(p));
    else if (entry.name.endsWith(".yaml")) out.push(p);
  }
  return out;
}

export function checkConformance(dir: string, knownIds: Set<string>, schema: object): Finding[] {
  const findings: Finding[] = [];
  const validate = compileSchema(schema);

  let files: string[];
  try {
    files = collectFiles(dir);
  } catch {
    return findings; // conformance dir absent
  }

  for (const file of files) {
    let doc: unknown;
    try {
      doc = parse(readFileSync(file, "utf8"));
    } catch (e) {
      findings.push({ level: "error", file, message: `YAML parse error: ${(e as Error).message}` });
      continue;
    }
    if (!validate(doc)) {
      for (const err of validate.errors ?? []) {
        findings.push({ level: "error", file, message: `conformance: ${err.instancePath || "/"} ${err.message ?? "invalid"}` });
      }
      continue;
    }
    const feature = (doc as { feature: string }).feature;
    if (!knownIds.has(feature)) {
      findings.push({ level: "error", file, message: `conformance vector references unknown feature id "${feature}"` });
    }
  }
  return findings;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd scripts/capability-matrix && npx vitest run test/conformance.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck and commit**

Run: `cd scripts/capability-matrix && npm run typecheck`
Expected: no errors.

```bash
git add schema/conformance.schema.json scripts/capability-matrix/src/conformance.ts scripts/capability-matrix/test/conformance.test.ts
git commit -m "feat: add conformance vector format and validator"
```

---

### Task 6: Wire the new checks into the validator `run()`

**Files:**
- Modify: `scripts/capability-matrix/src/cli.ts:1-42` and `:49-62`
- Test: `scripts/capability-matrix/test/run-codegen.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/capability-matrix/test/run-codegen.test.ts`:

```ts
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { run } from "../src/cli";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const schema = JSON.parse(readFileSync(join(root, "schema", "capability-matrix.schema.json"), "utf8"));
const codegenSchema = JSON.parse(readFileSync(join(root, "schema", "codegen.schema.json"), "utf8"));

describe("run() with codegen checks", () => {
  it("flags a feature bound to a spec absent from codegen.yaml", async () => {
    const capDir = mkdtempSync(join(tmpdir(), "cap-"));
    writeFileSync(
      join(capDir, "storage.yaml"),
      "area: storage\ntitle: Storage\ndescription: d\nfeatures:\n  - id: storage.objects.upload\n    name: Upload\n    description: d\n    binding:\n      spec: ghost\n      operationId: uploadObject\n",
    );
    const cfgDir = mkdtempSync(join(tmpdir(), "cfg-"));
    const cfgPath = join(cfgDir, "codegen.yaml");
    writeFileSync(
      cfgPath,
      "engine:\n  tool: openapi-generator\n  version: 7.10.0\nspecs:\n  storage:\n    source: x\n    version: v1\nlanguages:\n  swift:\n    generator: swift5\n    templates: templates/swift\n",
    );

    const result = await run({ mode: "validate", capabilitiesDir: capDir, schema, codegenConfigPath: cfgPath, codegenSchema });
    expect(result.findings.some((f) => f.message.includes('unknown spec "ghost"'))).toBe(true);
    expect(result.errorCount).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/capability-matrix && npx vitest run test/run-codegen.test.ts`
Expected: FAIL — `RunOptions` has no `codegenConfigPath`/`codegenSchema`, so `run()` never reports the binding error (TypeScript error and/or assertion failure).

- [ ] **Step 3: Extend `RunOptions` and `run()`**

In `scripts/capability-matrix/src/cli.ts`, update the imports at the top (lines 1-8):

```ts
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { loadAreas } from "./load";
import { checkSchema } from "./schema";
import { checkStructural, checkSpecs } from "./structural";
import { loadCodegenConfig, checkCodegenConfig } from "./codegen";
import { checkBindings } from "./bindings";
import { checkConformance } from "./conformance";
import { computeParity, type ParityReport } from "./report";
import type { Finding } from "./types";
```

Replace the `RunOptions` interface (lines 10-16):

```ts
export interface RunOptions {
  mode: "validate" | "report";
  capabilitiesDir: string;
  schema: object;
  specsDir?: string;
  changedFiles?: string[];
  codegenConfigPath?: string;
  codegenSchema?: object;
  conformanceDir?: string;
  conformanceSchema?: object;
}
```

Replace the validate-mode body of `run()` (lines 31-41) with:

```ts
  const findings: Finding[] = [...loadFindings];
  findings.push(...checkSchema(areas, opts.schema));
  findings.push(...checkStructural(areas));

  const knownIds = new Set(areas.flatMap((a) => a.area.features.map((f) => f.id)));

  if (opts.specsDir) {
    findings.push(...checkSpecs(opts.specsDir, knownIds));
  }

  if (opts.codegenConfigPath && opts.codegenSchema && existsSync(opts.codegenConfigPath)) {
    const { config, findings: loadFindings2 } = loadCodegenConfig(opts.codegenConfigPath);
    findings.push(...loadFindings2);
    if (config) {
      findings.push(...checkCodegenConfig(config, opts.codegenSchema, opts.codegenConfigPath));
      findings.push(...checkBindings(areas, config));
    }
  }

  if (opts.conformanceDir && opts.conformanceSchema) {
    findings.push(...checkConformance(opts.conformanceDir, knownIds, opts.conformanceSchema));
  }

  const errorCount = findings.filter((f) => f.level === "error").length;
  return { findings, errorCount };
```

- [ ] **Step 4: Wire the new paths into `main()`**

In `scripts/capability-matrix/src/cli.ts`, update the `run({...})` call inside `main()` (lines 55-62) to pass the codegen config and conformance dir:

```ts
  const schema = JSON.parse(readFileSync(join(root, "schema", "capability-matrix.schema.json"), "utf8"));
  const codegenSchema = JSON.parse(readFileSync(join(root, "schema", "codegen.schema.json"), "utf8"));
  const conformanceSchema = JSON.parse(readFileSync(join(root, "schema", "conformance.schema.json"), "utf8"));
  const result = await run({
    mode,
    capabilitiesDir: join(root, "capabilities"),
    specsDir: join(root, "specs"),
    schema,
    codegenConfigPath: join(root, "codegen.yaml"),
    codegenSchema,
    conformanceDir: join(root, "conformance"),
    conformanceSchema,
    changedFiles: positionals.length > 0 ? positionals : undefined,
  });
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd scripts/capability-matrix && npx vitest run test/run-codegen.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `cd scripts/capability-matrix && npm test && npm run typecheck`
Expected: all tests pass, no type errors. (The existing `npm run validate` still passes because `codegen.yaml` and `conformance/` are absent at the repo root, so those checks are skipped.)

- [ ] **Step 7: Commit**

```bash
git add scripts/capability-matrix/src/cli.ts scripts/capability-matrix/test/run-codegen.test.ts
git commit -m "feat: enforce codegen bindings and conformance vectors in validate"
```

---

### Task 7: Document the contract in the README

**Files:**
- Modify: `README.md` (append a "Code generation contract" section after "Adding or updating a capability")

- [ ] **Step 1: Add the documentation**

Append this section to `README.md` (place it after the "Adding or updating a capability" section):

````markdown
## Code generation contract

SDKs generate their transport, models, and error types from upstream OpenAPI specs. This repo is the contract:

- A feature may declare an optional `binding` to the OpenAPI operation it maps to:

  ```yaml
  - id: storage.objects.upload
    name: Upload Object
    description: Upload a file to a bucket.
    group: objects
    binding:
      spec: storage          # must match a spec id in codegen.yaml
      operationId: uploadObject
  ```

- `codegen.yaml` (repo root) pins the generator engine, the spec sources, and the per-language template packs:

  ```yaml
  engine:
    tool: openapi-generator
    version: 7.10.0
  specs:
    storage:
      source: https://.../storage/openapi.yaml
      version: <pin>
  languages:
    swift:
      generator: swift5
      templates: templates/swift
  ```

- `conformance/**/*.yaml` holds language-agnostic test vectors each SDK runs:

  ```yaml
  feature: storage.objects.upload
  cases:
    - name: uploads a small file
      input: { path: a.txt, body: hi }
      expected: { status: 200 }
  ```

`npm run validate` enforces that bindings reference declared specs, that `codegen.yaml` matches its schema, and that conformance vectors are well-formed and reference real features. The full schemas live in `schema/codegen.schema.json` and `schema/conformance.schema.json`.
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document the code generation contract"
```

---

## Follow-on plans (not in this plan)

These are gated on the discovery spike and/or live in another repo; they get their own plans once this foundation lands.

- **Plan 2 — Swift template pack + generation (this repo).** Open with a spike: run the pinned `openapi-generator` against the real Storage OpenAPI spec, inspect the default Swift output, and choose the generator id (`swift5`/`swift6`/etc.). Then author `codegen.yaml` for storage+swift, add real `binding`s to `capabilities/storage.yaml`, create `templates/swift/` tuned to emit public models/errors + internal transport, add `conformance/storage/` vectors, and add a thin spawn runner around `buildGenerateArgs`.
- **Plan 3 — supabase-swift `StorageGen` module (supabase-swift repo).** A parallel Storage target built on the generated core + hand-written surface, with the conformance vectors wired into the test suite and behavior parity demonstrated against the shipped `Storage` module. Cutover is a separate, later decision.

## Self-review notes

- **Spec coverage:** binding field (spec §6) → Task 1; `codegen.yaml` (§6) → Task 2; binding↔config validation / "no honor system" (§6) → Tasks 3, 6; `make generate` arg construction (§8) → Task 4 (spawn runner deferred to Plan 2, where a real spec exists to run it against); conformance format (§9) → Task 5; committed/CI enforcement (§8) → Task 6 via `npm run validate`. PostgREST/Realtime (§10), the Swift module (§11), and rollout (§12) are explicitly out of this plan.
- **Type consistency:** `Binding { spec, operationId }`, `CodegenConfig { engine, specs, languages }`, `LanguageConfig { generator, templates, generatorProperties? }`, `GenerateTarget { spec, language, outDir }`, and `checkBindings`/`checkCodegenConfig`/`checkConformance`/`buildGenerateArgs` names are used identically across tasks and tests.
- **No placeholders:** every step ships real code, real commands, and expected output.
