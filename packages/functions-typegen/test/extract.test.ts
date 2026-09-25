import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  createLocalDenoRunner,
  createSpawnDenoRunner,
  type DenoRunner,
} from "../src/deno.ts";
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

  test("runs deno from the project root with the import map the CLI would use", async () => {
    const requests: (readonly string[])[] = [];
    const recording: DenoRunner = {
      run(request) {
        requests.push(request.args);
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
    const doc = ["doc", "--json", "--private", "--no-lock", "--no-config"];
    expect(requests).toEqual([
      ["--version"],
      [
        ...doc,
        "--import-map",
        "supabase/functions/greet/deno.json",
        "supabase/functions/greet/index.ts",
      ],
      [
        ...doc,
        "--import-map",
        "supabase/custom/import_map.json",
        "supabase/custom/handler.ts",
      ],
      [...doc, "supabase/functions/plain/index.ts"],
    ]);
  });

  test("follows imports through URL paths, so a Windows file URL still yields a relative target", async () => {
    const entry = "file:///C:/project/supabase/functions/greet/index.ts";
    const shared = "file:///C:/project/supabase/functions/_shared/types.ts";
    const requests: (readonly string[])[] = [];
    const windowsRunner: DenoRunner = {
      run(request) {
        if (request.args[0] === "--version") {
          return Promise.resolve({
            exitCode: 0,
            stdout: "deno 2.9.6",
            stderr: "",
          });
        }
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
    expect(requests[1]?.at(-1)).toBe("supabase/functions/_shared/types.ts");
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

  test("a machine without Deno yields one project-level diagnostic and name-only functions", async () => {
    const noDeno: DenoRunner = {
      run: () =>
        Promise.resolve({
          exitCode: 1,
          stdout: "",
          stderr: "spawn deno ENOENT\n",
        }),
    };
    const document = await extractEdgeFunctionsMetadata({
      projectRoot,
      deno: noDeno,
      functions: [
        {
          slug: "x",
          entrypoint: "supabase/functions/x/index.ts",
          importMap: null,
          verifyJwt: true,
        },
        {
          slug: "y",
          entrypoint: "supabase/functions/y/index.ts",
          importMap: null,
          verifyJwt: true,
        },
      ],
    });
    expect(
      document.functions.map((fn) => [fn.slug, fn.requestBody, fn.types]),
    ).toEqual([
      ["x", null, []],
      ["y", null, []],
    ]);
    expect(document.diagnostics).toEqual([
      {
        slug: "",
        path: "",
        message:
          "Deno is needed to read Edge Function contracts, but `deno --version` failed, so every function is listed without one:\nspawn deno ENOENT",
      },
    ]);
  });

  test("a deno doc failure becomes a diagnostic on the function instead of an exception", async () => {
    const failing: DenoRunner = {
      run: (request) =>
        Promise.resolve(
          request.args[0] === "--version"
            ? { exitCode: 0, stdout: "deno 2.9.6", stderr: "" }
            : { exitCode: 1, stdout: "", stderr: "error: boom\n" },
        ),
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

  test("createSpawnDenoRunner turns an unstartable command into a failed result", async () => {
    const runner = createSpawnDenoRunner(() =>
      Promise.reject(
        Object.assign(new Error("spawn deno ENOENT"), { code: "ENOENT" }),
      ),
    );
    expect(await runner.run({ args: ["--version"], projectRoot })).toEqual({
      exitCode: 1,
      stdout: "",
      stderr: "spawn deno ENOENT",
    });
  });

  test("createSpawnDenoRunner runs the command from the project root with colours off", async () => {
    const seen: {
      command: string;
      cwd: string;
      args: readonly string[];
      noColor: string | undefined;
    }[] = [];
    const escape = String.fromCharCode(27);
    const runner = createSpawnDenoRunner(
      (request) => {
        seen.push({
          command: request.command,
          cwd: request.cwd,
          args: request.args,
          noColor: request.env["NO_COLOR"],
        });
        return Promise.resolve({
          exitCode: null,
          stdout: "",
          stderr: `${escape}[33mWarning${escape}[0m x`,
        });
      },
      { command: "/opt/deno/bin/deno" },
    );
    const result = await runner.run({ args: ["doc", "a.ts"], projectRoot });
    expect(seen).toEqual([
      {
        command: "/opt/deno/bin/deno",
        cwd: projectRoot,
        args: ["doc", "a.ts"],
        noColor: "1",
      },
    ]);
    expect(result).toEqual({ exitCode: 1, stdout: "", stderr: "Warning x" });
  });
});

function withoutBroken(document: EdgeFunctionsMetadata): EdgeFunctionsMetadata {
  return {
    ...document,
    diagnostics: document.diagnostics.filter((d) => d.slug !== "broken"),
  };
}
