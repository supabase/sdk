# TypeScript Parser TypeDoc Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `ts-parser.ts` (hand-rolled TypeScript AST walker) with a thin normalizer over TypeDoc 0.27 JSON output, following the same "external tool → normalizer → ParseResult" architecture as the Dart parser added in PR #35.

**Architecture:** TypeDoc 0.27 runs in CI inside the SDK repo (after `npm ci`), producing a JSON file of all public declarations. `normalize-typedoc.ts` maps TypeDoc's reflection kinds to the existing `ParseResult` shape. `check-api-symbols` and everything downstream are untouched. `ParsedSymbol`/`ParseResult` type definitions move from `ts-parser.ts` to `normalize-typedoc.ts`; `swift-parser.ts` re-imports from there.

**Tech Stack:** TypeScript 5, TypeDoc 0.27, Vitest 4, Node 22, `tsx` for dev scripts

## Global Constraints

- TypeDoc pinned at `0.27` — invoked as `npx --yes typedoc@0.27`
- `ParsedSymbol.kind` stays `"class" | "method" | "property" | "function" | "variable"` — no new values
- `check-api-symbols.ts` and `api-check.ts` are not modified
- All existing tests must pass after cleanup
- Conventional commits: `feat:`, `refactor:`, `test:`, `ci:`
- All scripts in `package.json` use `tsx` prefix (matches existing pattern)
- Working directory for capability-matrix commands: `scripts/capability-matrix/`

---

### Task 1: Generate typedoc-sample.json fixture

**Files:**
- Create: `scripts/capability-matrix/test/fixtures/typedoc-sample.json`

**Interfaces:**
- Produces: real TypeDoc 0.27 JSON consumed by fixture-based tests in Task 2

- [ ] **Step 1: Create a minimal TypeScript project in a temp directory**

```bash
mkdir -p /tmp/typedoc-fixture/src
```

Write `/tmp/typedoc-fixture/src/index.ts`:
```typescript
export class AuthClient {
  constructor(private url: string) {}
  signUp(email: string): void {}
  signIn(): void {}
  get session(): string { return ""; }
  private _cache = new Map();
}

export interface Session {
  user: string;
  expires: Date;
}

export enum UserRole {
  Admin = "admin",
  User = "user",
}

export type AuthResponse = { data: unknown; error: Error | null };

export function createClient(url: string): AuthClient {
  return new AuthClient(url);
}

export const VERSION = "1.0.0";

export { AuthClient as Client };
```

Write `/tmp/typedoc-fixture/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true
  },
  "include": ["src"]
}
```

Write `/tmp/typedoc-fixture/package.json`:
```json
{ "name": "fixture", "version": "1.0.0", "type": "module" }
```

- [ ] **Step 2: Install TypeDoc and generate JSON**

```bash
cd /tmp/typedoc-fixture
npm install --save-dev typedoc@0.27
npx typedoc --json api.json --excludePrivate --excludeProtected src/index.ts
```

Expected: `api.json` is created. TypeDoc may emit warnings — these are fine as long as the file is produced.

- [ ] **Step 3: Copy the fixture into the repo**

```bash
cp /tmp/typedoc-fixture/api.json \
  <repo-root>/scripts/capability-matrix/test/fixtures/typedoc-sample.json
```

Replace `<repo-root>` with the actual absolute path to the repo.

- [ ] **Step 4: Sanity-check the fixture**

```bash
cd scripts/capability-matrix
node --input-type=module <<'EOF'
import { readFileSync } from "fs";
const f = JSON.parse(readFileSync("test/fixtures/typedoc-sample.json", "utf8"));
const walk = (children) => children.flatMap(c => c.kind === 2 ? walk(c.children ?? []) : [c]);
console.log(walk(f.children ?? []).map(c => `${c.kind} ${c.name}`));
EOF
```

Expected output includes lines like `128 AuthClient`, `256 Session`, `8 UserRole`, `64 createClient`, `32 VERSION`, `2097152 AuthResponse` and a Reference line for `Client`.

- [ ] **Step 5: Commit**

```bash
git add scripts/capability-matrix/test/fixtures/typedoc-sample.json
git commit -m "test: add real typedoc-sample.json fixture for normalizer tests"
```

---

### Task 2: TDD — write tests, implement normalize-typedoc.ts

**Files:**
- Create: `scripts/capability-matrix/src/normalize-typedoc.ts`
- Create: `scripts/capability-matrix/test/normalize-typedoc.test.ts`
- Modify: `scripts/capability-matrix/src/swift-parser.ts` (update import path only)

**Interfaces:**
- Produces: `normalize(json: unknown): ParseResult` exported from `normalize-typedoc.ts`
- Produces: `ParsedSymbol`, `ParseResult` types exported from `normalize-typedoc.ts` (replacing `ts-parser.ts` as the canonical source)

- [ ] **Step 1: Write the failing tests**

Create `scripts/capability-matrix/test/normalize-typedoc.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { normalize } from "../src/normalize-typedoc.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Inline JSON helpers ──────────────────────────────────────────────────────
// Each builds the minimal TypeDoc shape needed for a specific case.

function project(...children: object[]) {
  return { kind: 1, name: "test", children };
}
function mod(name: string, ...children: object[]) {
  return { kind: 2, name, flags: {}, children };
}
function cls(name: string, file: string, ...members: object[]) {
  return { kind: 128, name, flags: {}, sources: [{ fileName: file }], children: members };
}
function iface(name: string, file: string, ...members: object[]) {
  return { kind: 256, name, flags: {}, sources: [{ fileName: file }], children: members };
}
function enumDecl(name: string, file: string, ...members: object[]) {
  return { kind: 8, name, flags: {}, sources: [{ fileName: file }], children: members };
}
function method(name: string, file: string) {
  return { kind: 2048, name, flags: {}, sources: [{ fileName: file }] };
}
function prop(name: string, file: string) {
  return { kind: 1024, name, flags: {}, sources: [{ fileName: file }] };
}
function accessor(name: string, file: string) {
  return { kind: 262144, name, flags: {}, sources: [{ fileName: file }] };
}
function ctor(file: string) {
  return { kind: 512, name: "constructor", flags: {}, sources: [{ fileName: file }] };
}
function enumMember(name: string, file: string) {
  return { kind: 16, name, flags: {}, sources: [{ fileName: file }] };
}
function fn(name: string, file: string) {
  return { kind: 64, name, flags: {}, sources: [{ fileName: file }] };
}
function variable(name: string, file: string) {
  return { kind: 32, name, flags: {}, sources: [{ fileName: file }] };
}
function typeAlias(name: string, file: string) {
  return { kind: 2097152, name, flags: {}, sources: [{ fileName: file }] };
}
function ref(name: string) {
  return { kind: 4194304, name, flags: {} };
}
function privateFlag(base: object): object {
  return { ...base, flags: { isPrivate: true } };
}
function protectedFlag(base: object): object {
  return { ...base, flags: { isProtected: true } };
}

// ── Unit tests (inline JSON) ─────────────────────────────────────────────────

describe("normalize — class", () => {
  it("emits class symbol", () => {
    const result = normalize(project(cls("AuthClient", "src/auth.ts")));
    expect(result.symbols).toContainEqual({ name: "AuthClient", kind: "class", file: "src/auth.ts" });
  });

  it("emits class method", () => {
    const result = normalize(project(cls("AuthClient", "src/auth.ts", method("signUp", "src/auth.ts"))));
    expect(result.symbols).toContainEqual({ name: "AuthClient.signUp", kind: "method", file: "src/auth.ts" });
  });

  it("emits class property", () => {
    const result = normalize(project(cls("AuthClient", "src/auth.ts", prop("session", "src/auth.ts"))));
    expect(result.symbols).toContainEqual({ name: "AuthClient.session", kind: "property", file: "src/auth.ts" });
  });

  it("emits accessor as method kind", () => {
    const result = normalize(project(cls("AuthClient", "src/auth.ts", accessor("token", "src/auth.ts"))));
    expect(result.symbols).toContainEqual({ name: "AuthClient.token", kind: "method", file: "src/auth.ts" });
  });

  it("skips constructor", () => {
    const result = normalize(project(cls("Foo", "src/foo.ts", ctor("src/foo.ts"), method("bar", "src/foo.ts"))));
    const names = result.symbols.map(s => s.name);
    expect(names).not.toContain("Foo.constructor");
    expect(names).toContain("Foo.bar");
  });
});

describe("normalize — interface", () => {
  it("emits interface as class kind", () => {
    const result = normalize(project(iface("Session", "src/session.ts")));
    expect(result.symbols).toContainEqual({ name: "Session", kind: "class", file: "src/session.ts" });
  });

  it("emits interface members as property", () => {
    const result = normalize(project(iface("Session", "src/session.ts", prop("user", "src/session.ts"))));
    expect(result.symbols).toContainEqual({ name: "Session.user", kind: "property", file: "src/session.ts" });
  });
});

describe("normalize — enum", () => {
  it("emits enum as class kind", () => {
    const result = normalize(project(enumDecl("UserRole", "src/role.ts")));
    expect(result.symbols).toContainEqual({ name: "UserRole", kind: "class", file: "src/role.ts" });
  });

  it("emits enum member as property kind", () => {
    const result = normalize(project(enumDecl("UserRole", "src/role.ts", enumMember("Admin", "src/role.ts"))));
    expect(result.symbols).toContainEqual({ name: "UserRole.Admin", kind: "property", file: "src/role.ts" });
  });
});

describe("normalize — top-level declarations", () => {
  it("emits exported function", () => {
    const result = normalize(project(fn("createClient", "src/index.ts")));
    expect(result.symbols).toContainEqual({ name: "createClient", kind: "function", file: "src/index.ts" });
  });

  it("emits exported variable", () => {
    const result = normalize(project(variable("VERSION", "src/index.ts")));
    expect(result.symbols).toContainEqual({ name: "VERSION", kind: "variable", file: "src/index.ts" });
  });

  it("emits type alias as variable kind", () => {
    const result = normalize(project(typeAlias("AuthResponse", "src/types.ts")));
    expect(result.symbols).toContainEqual({ name: "AuthResponse", kind: "variable", file: "src/types.ts" });
  });

  it("skips Reference kind", () => {
    const result = normalize(project(cls("AuthClient", "src/auth.ts"), ref("Client")));
    const names = result.symbols.map(s => s.name);
    expect(names).not.toContain("Client");
    expect(names).toContain("AuthClient");
  });
});

describe("normalize — traversal", () => {
  it("walks into Module wrapper (kind 2)", () => {
    const result = normalize(project(mod("src/auth", cls("AuthClient", "src/auth.ts"))));
    expect(result.symbols).toContainEqual({ name: "AuthClient", kind: "class", file: "src/auth.ts" });
  });

  it("captures file path from sources[0].fileName", () => {
    const result = normalize(project(fn("foo", "packages/core/src/index.ts")));
    expect(result.symbols[0]?.file).toBe("packages/core/src/index.ts");
  });
});

describe("normalize — privacy (defensive filter)", () => {
  it("skips member with isPrivate flag", () => {
    const result = normalize(project(
      cls("Foo", "src/foo.ts", privateFlag(prop("secret", "src/foo.ts")))
    ));
    expect(result.symbols.map(s => s.name)).not.toContain("Foo.secret");
  });

  it("skips member with isProtected flag", () => {
    const result = normalize(project(
      cls("Foo", "src/foo.ts", protectedFlag(prop("internal", "src/foo.ts")))
    ));
    expect(result.symbols.map(s => s.name)).not.toContain("Foo.internal");
  });
});

// ── Fixture tests ────────────────────────────────────────────────────────────
// These run against real TypeDoc 0.27 output generated from the minimal
// TS project in test/fixtures/typedoc-sample.json.

describe("normalize (fixture — real TypeDoc 0.27 output)", () => {
  const fixture = JSON.parse(
    readFileSync(join(__dirname, "fixtures/typedoc-sample.json"), "utf8")
  );

  it("finds AuthClient class", () => {
    const names = normalize(fixture).symbols.map(s => s.name);
    expect(names).toContain("AuthClient");
  });

  it("finds AuthClient.signUp method", () => {
    const names = normalize(fixture).symbols.map(s => s.name);
    expect(names).toContain("AuthClient.signUp");
  });

  it("finds Session interface as class kind", () => {
    const sym = normalize(fixture).symbols.find(s => s.name === "Session");
    expect(sym?.kind).toBe("class");
  });

  it("finds UserRole enum as class kind", () => {
    const sym = normalize(fixture).symbols.find(s => s.name === "UserRole");
    expect(sym?.kind).toBe("class");
  });

  it("finds AuthResponse type alias as variable kind", () => {
    const sym = normalize(fixture).symbols.find(s => s.name === "AuthResponse");
    expect(sym?.kind).toBe("variable");
  });

  it("finds createClient function", () => {
    const sym = normalize(fixture).symbols.find(s => s.name === "createClient");
    expect(sym?.kind).toBe("function");
  });

  it("finds VERSION variable", () => {
    const sym = normalize(fixture).symbols.find(s => s.name === "VERSION");
    expect(sym?.kind).toBe("variable");
  });

  it("does not emit Client (re-export Reference)", () => {
    const names = normalize(fixture).symbols.map(s => s.name);
    expect(names).not.toContain("Client");
  });

  it("does not emit constructor", () => {
    const names = normalize(fixture).symbols.map(s => s.name);
    expect(names).not.toContain("AuthClient.constructor");
  });

  it("does not emit private _cache field", () => {
    const names = normalize(fixture).symbols.map(s => s.name);
    expect(names).not.toContain("AuthClient._cache");
  });
});
```

- [ ] **Step 2: Run the tests — expect failure**

```bash
cd scripts/capability-matrix
npx vitest run test/normalize-typedoc.test.ts 2>&1 | head -20
```

Expected: `Cannot find module '../src/normalize-typedoc.js'`

- [ ] **Step 3: Implement normalize-typedoc.ts**

Create `scripts/capability-matrix/src/normalize-typedoc.ts`:

```typescript
export interface ParsedSymbol {
  name: string;
  kind: "class" | "method" | "property" | "function" | "variable";
  file: string;
}

export interface ParseResult {
  symbols: ParsedSymbol[];
}

// TypeDoc ReflectionKind numeric constants used by the normalizer.
const Kind = {
  Module: 2,
  Namespace: 4,
  Enum: 8,
  EnumMember: 16,
  Variable: 32,
  Function: 64,
  Class: 128,
  Interface: 256,
  Constructor: 512,
  Property: 1024,
  Method: 2048,
  Accessor: 262144,
  TypeAlias: 2097152,
  Reference: 4194304,
} as const;

interface TdReflection {
  name: string;
  kind: number;
  flags?: { isPrivate?: boolean; isProtected?: boolean };
  sources?: Array<{ fileName: string }>;
  children?: TdReflection[];
}

function fileOf(r: TdReflection): string {
  return r.sources?.[0]?.fileName ?? "";
}

function isExcluded(r: TdReflection): boolean {
  return !!(r.flags?.isPrivate || r.flags?.isProtected);
}

function extractMembers(
  parent: string,
  children: TdReflection[],
  out: ParsedSymbol[],
): void {
  for (const child of children) {
    if (isExcluded(child)) continue;
    if (child.kind === Kind.Constructor) continue;
    const qualName = `${parent}.${child.name}`;
    const file = fileOf(child);
    if (child.kind === Kind.Method) {
      out.push({ name: qualName, kind: "method", file });
    } else if (child.kind === Kind.Property) {
      out.push({ name: qualName, kind: "property", file });
    } else if (child.kind === Kind.Accessor) {
      out.push({ name: qualName, kind: "method", file });
    } else if (child.kind === Kind.EnumMember) {
      out.push({ name: qualName, kind: "property", file });
    }
  }
}

function extractDeclarations(
  children: TdReflection[],
  out: ParsedSymbol[],
): void {
  for (const child of children) {
    if (isExcluded(child)) continue;
    const file = fileOf(child);
    if (child.kind === Kind.Module || child.kind === Kind.Namespace) {
      if (child.children) extractDeclarations(child.children, out);
    } else if (child.kind === Kind.Reference) {
      continue;
    } else if (
      child.kind === Kind.Class ||
      child.kind === Kind.Interface ||
      child.kind === Kind.Enum
    ) {
      out.push({ name: child.name, kind: "class", file });
      if (child.children) extractMembers(child.name, child.children, out);
    } else if (child.kind === Kind.Function) {
      out.push({ name: child.name, kind: "function", file });
    } else if (child.kind === Kind.Variable || child.kind === Kind.TypeAlias) {
      out.push({ name: child.name, kind: "variable", file });
    }
  }
}

export function normalize(json: unknown): ParseResult {
  const project = json as TdReflection;
  const symbols: ParsedSymbol[] = [];
  if (project.children) extractDeclarations(project.children, symbols);
  return { symbols };
}
```

- [ ] **Step 4: Update swift-parser.ts to import from normalize-typedoc.ts**

In `scripts/capability-matrix/src/swift-parser.ts`, find these two lines at the top:

```typescript
import type { ParsedSymbol, ParseResult } from "./ts-parser.js";
export type { ParsedSymbol, ParseResult };
```

Change to:

```typescript
import type { ParsedSymbol, ParseResult } from "./normalize-typedoc.js";
export type { ParsedSymbol, ParseResult };
```

- [ ] **Step 5: Run the tests — expect all pass**

```bash
cd scripts/capability-matrix
npx vitest run test/normalize-typedoc.test.ts
```

Expected: All tests PASS. If fixture tests fail with "AuthClient not found", re-run Task 1 Step 4 to confirm the fixture shape.

- [ ] **Step 6: Run the full suite to confirm no regressions**

```bash
cd scripts/capability-matrix
npm test
```

Expected: All tests pass. `ts-parser.test.ts` may fail (it's deleted in Task 5 — that's expected).

- [ ] **Step 7: Commit**

```bash
git add scripts/capability-matrix/src/normalize-typedoc.ts \
        scripts/capability-matrix/src/swift-parser.ts \
        scripts/capability-matrix/test/normalize-typedoc.test.ts
git commit -m "feat: add normalize-typedoc with TypeDoc JSON → ParseResult mapping"
```

---

### Task 3: CLI wrapper and package.json

**Files:**
- Create: `scripts/capability-matrix/src/normalize-typedoc-cli.ts`
- Modify: `scripts/capability-matrix/package.json`

**Interfaces:**
- Consumes: `normalize(json: unknown): ParseResult` from `./normalize-typedoc.js`
- Produces: `normalize-typedoc` script; invoked as `npm run normalize-typedoc -- <input.json> <output.json>`

- [ ] **Step 1: Write the CLI**

Create `scripts/capability-matrix/src/normalize-typedoc-cli.ts`:

```typescript
import { readFileSync, writeFileSync } from "node:fs";
import { normalize } from "./normalize-typedoc.js";

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  console.error("Usage: normalize-typedoc <input.json> <output.json>");
  process.exit(1);
}

const json = JSON.parse(readFileSync(inputPath, "utf8"));
const result = normalize(json);
writeFileSync(outputPath, JSON.stringify(result, null, 2));
```

- [ ] **Step 2: Update package.json**

In `scripts/capability-matrix/package.json`, inside `"scripts"`:

Replace:
```json
"parse-ts": "tsx src/parse-ts.ts",
```

With:
```json
"normalize-typedoc": "tsx src/normalize-typedoc-cli.ts",
```

- [ ] **Step 3: Smoke-test the CLI**

```bash
cd scripts/capability-matrix
npm run normalize-typedoc -- test/fixtures/typedoc-sample.json /tmp/ts-symbols.json
node -e "const r = JSON.parse(require('fs').readFileSync('/tmp/ts-symbols.json','utf8')); console.log(r.symbols.slice(0,5))"
```

Expected: Array of 5 `ParsedSymbol` objects with names like `AuthClient`, `AuthClient.signUp`, etc.

- [ ] **Step 4: Commit**

```bash
git add scripts/capability-matrix/src/normalize-typedoc-cli.ts \
        scripts/capability-matrix/package.json
git commit -m "feat: add normalize-typedoc-cli and update package.json"
```

---

### Task 4: Update validate-sdk-compliance.yml

**Files:**
- Modify: `.github/workflows/validate-sdk-compliance.yml`

**Interfaces:**
- Produces: TypeScript-conditional steps that replace the `parse-ts` invocation; base/PR symbol files produced at `$GITHUB_WORKSPACE/pr-symbols.json` and `$GITHUB_WORKSPACE/base-symbols.json` (same paths the existing `check-api-symbols` step reads)

- [ ] **Step 1: Add the entrypoint input**

In the `workflow_call.inputs` block, add after the existing `sdk-ref` input:

```yaml
      entrypoint:
        description: TypeScript entrypoint file relative to SDK root (TypeScript SDKs only)
        type: string
        default: src/index.ts
```

- [ ] **Step 2: Add TypeScript-conditional steps before the existing "Resolve parse command" step**

In the `check` job, insert the following steps between `Install dependencies` and `Resolve parse command`:

```yaml
      - name: Install PR SDK dependencies (TypeScript)
        if: inputs.language == 'javascript'
        run: npm ci
        working-directory: _sdk-pr

      - name: Generate TypeDoc JSON — PR branch
        if: inputs.language == 'javascript'
        run: |
          npx --yes typedoc@0.27 \
            --json "$GITHUB_WORKSPACE/pr-raw.json" \
            --excludePrivate --excludeProtected \
            ${{ inputs.entrypoint }}
        working-directory: _sdk-pr

      - name: Install base SDK dependencies (TypeScript)
        if: inputs.language == 'javascript'
        run: npm ci
        working-directory: _sdk-base

      - name: Generate TypeDoc JSON — base branch
        if: inputs.language == 'javascript'
        run: |
          npx --yes typedoc@0.27 \
            --json "$GITHUB_WORKSPACE/base-raw.json" \
            --excludePrivate --excludeProtected \
            ${{ inputs.entrypoint }}
        working-directory: _sdk-base

      - name: Normalize TypeDoc output (TypeScript)
        if: inputs.language == 'javascript'
        run: |
          npm run --silent normalize-typedoc -- \
            "$GITHUB_WORKSPACE/pr-raw.json" "$GITHUB_WORKSPACE/pr-symbols.json"
          npm run --silent normalize-typedoc -- \
            "$GITHUB_WORKSPACE/base-raw.json" "$GITHUB_WORKSPACE/base-symbols.json"
        working-directory: _sdk-spec/scripts/capability-matrix
```

- [ ] **Step 3: Gate the existing parse steps on non-javascript**

The existing `Resolve parse command`, `Parse PR branch`, and `Parse base branch` steps currently run for all languages. Add `if: inputs.language != 'javascript'` to each:

```yaml
      - name: Resolve parse command
        if: inputs.language != 'javascript'
        id: resolve
        run: |
          case "${{ inputs.language }}" in
            swift)      echo "cmd=parse-swift" >> "$GITHUB_OUTPUT" ;;
            *) echo "::error::Unsupported language '${{ inputs.language }}'. Supported values: swift, javascript (javascript uses typedoc path)"; exit 1 ;;
          esac

      - name: Parse PR branch
        if: inputs.language != 'javascript'
        run: |
          npm run --silent ${{ steps.resolve.outputs.cmd }} -- "$GITHUB_WORKSPACE/_sdk-pr" \
            > "$GITHUB_WORKSPACE/pr-symbols.json"
        working-directory: _sdk-spec/scripts/capability-matrix

      - name: Parse base branch
        if: inputs.language != 'javascript'
        run: |
          npm run --silent ${{ steps.resolve.outputs.cmd }} -- "$GITHUB_WORKSPACE/_sdk-base" \
            > "$GITHUB_WORKSPACE/base-symbols.json"
        working-directory: _sdk-spec/scripts/capability-matrix
```

The `Check new symbols against capability matrix` step has no `if` condition — it runs for both languages and reads `pr-symbols.json` / `base-symbols.json` regardless of which path produced them.

- [ ] **Step 4: Validate the YAML**

```bash
npx js-yaml .github/workflows/validate-sdk-compliance.yml > /dev/null && echo "YAML valid"
```

Expected: `YAML valid`

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/validate-sdk-compliance.yml
git commit -m "ci: replace parse-ts with typedoc + normalize-typedoc in validate-sdk-compliance"
```

---

### Task 5: Delete old files and final verification

**Files:**
- Delete: `scripts/capability-matrix/src/ts-parser.ts`
- Delete: `scripts/capability-matrix/src/parse-ts.ts`
- Delete: `scripts/capability-matrix/test/ts-parser.test.ts`
- Delete: `scripts/capability-matrix/test/fixtures/ts-sample/`

- [ ] **Step 1: Confirm nothing still imports ts-parser**

```bash
cd scripts/capability-matrix
grep -r "ts-parser" src/ test/ --include="*.ts" -l
```

Expected: No output. If any file appears, update its import to reference `normalize-typedoc.js` instead.

- [ ] **Step 2: Delete the old files**

```bash
rm scripts/capability-matrix/src/ts-parser.ts
rm scripts/capability-matrix/src/parse-ts.ts
rm scripts/capability-matrix/test/ts-parser.test.ts
rm -rf scripts/capability-matrix/test/fixtures/ts-sample/
```

- [ ] **Step 3: Run the full test suite**

```bash
cd scripts/capability-matrix
npm test
```

Expected: All tests pass with no failures or type errors.

- [ ] **Step 4: Run typecheck**

```bash
cd scripts/capability-matrix
npm run typecheck
```

Expected: No errors. If `ts-parser` is still referenced in a type import somewhere, fix the import and re-run.

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "refactor: remove ts-parser and parse-ts in favor of normalize-typedoc"
```
