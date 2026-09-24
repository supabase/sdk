import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { createLocalDenoRunner, type DenoRunner } from "../src/deno.ts";
import { extractEdgeFunctionsMetadata } from "../src/extract.ts";
import {
  parseEdgeFunctionsMetadata,
  type EdgeFunctionsMetadata,
} from "../src/types.ts";

const projectRoot = join(import.meta.dir, "fixtures", "project");
const expectedPath = join(
  import.meta.dir,
  "fixtures",
  "expected",
  "project.json",
);

/**
 * End-to-end run against the fixture project with the `deno` binary on this
 * machine. The whole document is pinned in `fixtures/expected/project.json`;
 * regenerate it with `bun run update-expected` after an intentional change and
 * review the diff. Only the `broken` function's diagnostic is checked loosely,
 * since its message carries Deno's own wording and an absolute path.
 */
describe("extractEdgeFunctionsMetadata", () => {
  test("extracts the fixture project into the expected document", async () => {
    const actual = await extractEdgeFunctionsMetadata({
      projectRoot,
      deno: createLocalDenoRunner(),
    });
    const expected = parseEdgeFunctionsMetadata(
      JSON.parse(await readFile(expectedPath, "utf8")),
    );

    const brokenDiagnostics = actual.diagnostics.filter(
      (d) => d.slug === "broken",
    );
    expect(brokenDiagnostics).toHaveLength(1);
    expect(brokenDiagnostics[0]?.path).toBe("");
    expect(brokenDiagnostics[0]?.message).toStartWith(
      "deno doc failed for supabase/functions/broken/index.ts:",
    );

    expect(withoutBroken(actual)).toEqual(withoutBroken(expected));
  });

  test("validates against the schema and round-trips through JSON", async () => {
    const document = await extractEdgeFunctionsMetadata({
      projectRoot,
      deno: createLocalDenoRunner(),
    });
    expect(
      parseEdgeFunctionsMetadata(JSON.parse(JSON.stringify(document))),
    ).toEqual(document);
  });

  test("runs deno from the function directory with the import map the CLI would use", async () => {
    const requests: { args: readonly string[]; cwd: string }[] = [];
    const recording: DenoRunner = {
      run(request) {
        requests.push({ args: request.args, cwd: request.cwd });
        return Promise.resolve({
          exitCode: 0,
          stdout: '{"version":2,"nodes":{}}',
          stderr: "",
        });
      },
    };
    await extractEdgeFunctionsMetadata({
      projectRoot,
      deno: recording,
      functions: [
        {
          slug: "greet",
          entrypoint: "supabase/functions/greet/index.ts",
          importMap: "supabase/functions/greet/deno.json",
          verifyJwt: true,
        },
        {
          slug: "custom-entry",
          entrypoint: "supabase/custom/handler.ts",
          importMap: "supabase/custom/import_map.json",
          verifyJwt: false,
        },
        {
          slug: "plain",
          entrypoint: "supabase/functions/plain/index.ts",
          importMap: null,
          verifyJwt: true,
        },
      ],
    });
    expect(requests).toEqual([
      {
        cwd: "supabase/functions/greet",
        args: [
          "doc",
          "--json",
          "--private",
          "--no-lock",
          "--config",
          "deno.json",
          "index.ts",
        ],
      },
      {
        cwd: "supabase/custom",
        args: [
          "doc",
          "--json",
          "--private",
          "--no-lock",
          "--import-map",
          "import_map.json",
          "handler.ts",
        ],
      },
      {
        cwd: "supabase/functions/plain",
        args: [
          "doc",
          "--json",
          "--private",
          "--no-lock",
          "--no-config",
          "index.ts",
        ],
      },
    ]);
  });

  test("follows imports through URL paths, so a Windows file URL still yields a relative target", async () => {
    const entry = "file:///C:/project/supabase/functions/greet/index.ts";
    const shared = "file:///C:/project/supabase/functions/_shared/types.ts";
    const requests: (readonly string[])[] = [];
    const windowsRunner: DenoRunner = {
      run(request) {
        requests.push(request.args);
        const nodes =
          requests.length === 1
            ? {
                [entry]: {
                  imports: [
                    {
                      importedName: "Shared",
                      originalName: "Shared",
                      src: shared,
                    },
                  ],
                  symbols: [
                    {
                      name: "RequestBody",
                      declarations: [
                        {
                          kind: "typeAlias",
                          declarationKind: "export",
                          def: {
                            tsType: {
                              kind: "typeRef",
                              repr: "Shared",
                              value: {
                                typeName: "Shared",
                                resolution: {
                                  kind: "import",
                                  specifier: "../_shared/types.ts",
                                  name: "Shared",
                                },
                              },
                            },
                          },
                          location: { filename: entry, line: 1, col: 0 },
                        },
                      ],
                    },
                  ],
                },
              }
            : {
                [shared]: {
                  symbols: [
                    {
                      name: "Shared",
                      declarations: [
                        {
                          kind: "typeAlias",
                          declarationKind: "export",
                          def: {
                            tsType: {
                              kind: "keyword",
                              repr: "string",
                              value: "string",
                            },
                          },
                          location: { filename: shared, line: 1, col: 0 },
                        },
                      ],
                    },
                  ],
                },
              };
        return Promise.resolve({
          exitCode: 0,
          stdout: JSON.stringify({ version: 2, nodes }),
          stderr: "",
        });
      },
    };
    const document = await extractEdgeFunctionsMetadata({
      projectRoot,
      deno: windowsRunner,
      functions: [
        {
          slug: "greet",
          entrypoint: "supabase/functions/greet/index.ts",
          importMap: null,
          verifyJwt: true,
        },
      ],
    });
    expect(requests[1]?.at(-1)).toBe("../_shared/types.ts");
    expect(document.functions[0]?.requestBody).toEqual({
      kind: "reference",
      name: "Shared",
    });
    expect(document.functions[0]?.types).toEqual([
      { name: "Shared", type: { kind: "string" } },
    ]);
    expect(document.diagnostics).toEqual([]);
  });

  test("an unexpected deno doc document becomes a diagnostic instead of an exception", async () => {
    const wrongShape: DenoRunner = {
      run: () =>
        Promise.resolve({
          exitCode: 0,
          stdout: '{"version":3,"nodes":[]}',
          stderr: "",
        }),
    };
    const document = await extractEdgeFunctionsMetadata({
      projectRoot,
      deno: wrongShape,
      functions: [
        {
          slug: "x",
          entrypoint: "supabase/functions/x/index.ts",
          importMap: null,
          verifyJwt: true,
        },
      ],
    });
    expect(document.functions[0]?.requestBody).toBeNull();
    expect(document.diagnostics).toEqual([
      {
        slug: "x",
        path: "",
        message:
          "deno doc produced an unsupported document for supabase/functions/x/index.ts; version 2 with modules keyed by URL is expected.",
      },
    ]);
  });

  test("a runner failure becomes a diagnostic on the function instead of an exception", async () => {
    const failing: DenoRunner = {
      run: () =>
        Promise.resolve({ exitCode: 1, stdout: "", stderr: "error: boom\n" }),
    };
    const document = await extractEdgeFunctionsMetadata({
      projectRoot,
      deno: failing,
      functions: [
        {
          slug: "x",
          entrypoint: "supabase/functions/x/index.ts",
          importMap: null,
          verifyJwt: true,
        },
      ],
    });
    expect(document.functions).toEqual([
      {
        slug: "x",
        entrypoint: "supabase/functions/x/index.ts",
        importMap: null,
        verifyJwt: true,
        requestBody: null,
        responseBody: null,
        types: [],
      },
    ]);
    expect(document.diagnostics).toEqual([
      {
        slug: "x",
        path: "",
        message:
          "deno doc failed for supabase/functions/x/index.ts:\nerror: boom",
      },
    ]);
  });
});

function withoutBroken(document: EdgeFunctionsMetadata): EdgeFunctionsMetadata {
  return {
    ...document,
    diagnostics: document.diagnostics.filter((d) => d.slug !== "broken"),
  };
}
