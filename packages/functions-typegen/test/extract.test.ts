import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { extractEdgeFunctions } from "../src/extract.ts";
import {
  type EdgeFunction,
  edgeFunctionSchema,
  GENERATOR_METADATA_VERSION,
  type GeneratorMetadata,
  parseGeneratorMetadata,
} from "@supabase/postgrest-typegen";

const projectRoot = join(import.meta.dir, "fixtures", "project");
const expectedPath = join(
  import.meta.dir,
  "fixtures",
  "expected",
  "project.json",
);

async function temporaryProject(
  files: Record<string, string>,
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "edge-functions-extract-"));
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(root, path, ".."), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return root;
}

/**
 * End-to-end run over the fixture project, pinned in
 * `fixtures/expected/project.json`. Regenerate it with
 * `bun run update-expected` after an intentional change and
 * review the diff: every change there is a change every consumer sees.
 */
describe("extractEdgeFunctions", () => {
  test("extracts the fixture project into the expected collection", async () => {
    const actual = await extractEdgeFunctions({ projectRoot });
    const expected = JSON.parse(
      await readFile(expectedPath, "utf8"),
    ) as EdgeFunction[];
    expect(actual).toEqual(expected);
  });

  test("produces entries the schema accepts and a document parseGeneratorMetadata accepts", async () => {
    const edgeFunctions = await extractEdgeFunctions({ projectRoot });
    for (const fn of edgeFunctions) {
      expect(edgeFunctionSchema.allows(fn)).toBe(true);
    }
    const metadata: GeneratorMetadata = {
      version: GENERATOR_METADATA_VERSION,
      schemas: [],
      tables: [],
      foreignTables: [],
      views: [],
      materializedViews: [],
      columns: [],
      primaryKeys: [],
      relationships: [],
      functions: [],
      types: [],
      edgeFunctions,
    };
    expect(
      parseGeneratorMetadata(JSON.parse(JSON.stringify(metadata))),
    ).toEqual(metadata);
  });

  test("a missing entrypoint keeps the function with a diagnostic instead of failing the run", async () => {
    const root = await temporaryProject({
      "supabase/config.toml":
        '[functions.ghost]\nentrypoint = "./ghost/index.ts"\n',
      "supabase/functions/real/index.ts":
        "export type RequestBody = { ok: boolean };",
    });
    const [ghost, real] = await extractEdgeFunctions({ projectRoot: root });
    expect(ghost).toEqual({
      slug: "ghost",
      entrypoint: "supabase/ghost/index.ts",
      importMap: null,
      verifyJwt: true,
      requestBody: null,
      responseBody: null,
      types: [],
      diagnostics: [
        {
          path: "",
          message:
            "The entrypoint supabase/ghost/index.ts does not exist or cannot be read.",
        },
      ],
    });
    expect(real?.requestBody).toEqual({
      kind: "object",
      properties: [{ name: "ok", type: { kind: "boolean" }, optional: false }],
    });
  });

  test("follows re-exports and star re-exports into shared modules", async () => {
    const root = await temporaryProject({
      "supabase/functions/_shared/base.ts":
        "export interface Base { id: string }\nexport type Unused = number;",
      "supabase/functions/_shared/mod.ts":
        'export * from "./base.ts";\nexport type { Base as Renamed } from "./base.ts";',
      "supabase/functions/greet/index.ts": [
        'import type { Base, Renamed } from "../_shared/mod.ts";',
        "export type RequestBody = { base: Base; renamed: Renamed };",
        'export type { Renamed as ResponseBody } from "../_shared/mod.ts";',
      ].join("\n"),
    });
    const [greet] = await extractEdgeFunctions({ projectRoot: root });
    expect(greet?.requestBody).toEqual({
      kind: "object",
      properties: [
        {
          name: "base",
          type: { kind: "reference", name: "Base" },
          optional: false,
        },
        {
          name: "renamed",
          type: { kind: "reference", name: "Base" },
          optional: false,
        },
      ],
    });
    // A root is inlined even when it is reached through a re-export.
    expect(greet?.responseBody).toEqual({
      kind: "object",
      properties: [{ name: "id", type: { kind: "string" }, optional: false }],
    });
    expect(greet?.types).toEqual([
      {
        name: "Base",
        type: {
          kind: "object",
          properties: [
            { name: "id", type: { kind: "string" }, optional: false },
          ],
        },
      },
    ]);
    expect(greet?.diagnostics).toEqual([]);
  });

  test("an imported type exported through an export list is the contract", async () => {
    const root = await temporaryProject({
      "supabase/functions/_shared/types.ts": [
        "export interface Greeting { name: string }",
        "export interface Reply { greeting: string }",
      ].join("\n"),
      "supabase/functions/greet/index.ts": [
        'import type { Greeting, Reply } from "../_shared/types.ts";',
        "export type { Greeting as RequestBody };",
        "export { Reply as ResponseBody };",
      ].join("\n"),
    });
    const [greet] = await extractEdgeFunctions({ projectRoot: root });
    expect(greet?.requestBody).toEqual({
      kind: "object",
      properties: [{ name: "name", type: { kind: "string" }, optional: false }],
    });
    expect(greet?.responseBody).toEqual({
      kind: "object",
      properties: [
        { name: "greeting", type: { kind: "string" }, optional: false },
      ],
    });
    expect(greet?.types).toEqual([]);
    expect(greet?.diagnostics).toEqual([]);
  });

  test("a syntax error becomes a diagnostic; what the parser recovered is still read", async () => {
    const root = await temporaryProject({
      "supabase/functions/greet/index.ts":
        "export type RequestBody = { a: string };\nlet x = 1;\nlet x = 2;\nexport type ResponseBody = { b: number };",
      "supabase/functions/broken/index.ts":
        "export type RequestBody = { a: string",
    });
    const [broken, greet] = await extractEdgeFunctions({ projectRoot: root });
    expect(greet?.diagnostics[0]?.message).toMatch(
      /^Syntax error in supabase\/functions\/greet\/index\.ts at \d+:\d+ /,
    );
    expect(greet?.responseBody).toEqual({
      kind: "object",
      properties: [{ name: "b", type: { kind: "number" }, optional: false }],
    });
    expect(broken?.requestBody).toBeNull();
    expect(broken?.diagnostics[0]?.message).toMatch(
      /^Syntax error in supabase\/functions\/broken\/index\.ts at \d+:\d+ /,
    );
  });

  test("an import map that cannot be read is reported and bare specifiers stay unresolved", async () => {
    const root = await temporaryProject({
      "supabase/config.toml":
        '[functions.greet]\nimport_map = "./missing_map.json"\n',
      "supabase/functions/greet/index.ts":
        'import type { X } from "@shared/x.ts";\nexport type RequestBody = X;',
    });
    const [greet] = await extractEdgeFunctions({ projectRoot: root });
    expect(greet?.diagnostics).toEqual([
      {
        path: "",
        message:
          "The import map supabase/missing_map.json does not exist or cannot be read; bare specifiers stay unresolved.",
      },
      {
        path: "RequestBody",
        message:
          "X comes from @shared/x.ts; only types declared in the project are extracted.",
      },
    ]);
  });
});
