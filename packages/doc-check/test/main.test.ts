import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { main, parseArguments } from "../src/index.ts";
import {
  createSchemaRepository,
  SCHEMA_PATH,
  type SchemaRepository,
  type SchemaServer,
  serveSchemas,
} from "./helpers.ts";

const CORPUS = join(import.meta.dir, "corpus");
const VALID = join(CORPUS, "valid");
const BUNDLED = "the bundled schema (supabase/supabase@7fba2c3)";

const run = async (...args: string[]) => {
  let stdout = "";
  let stderr = "";
  const code = await main(args, {
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });
  return { code, stdout, stderr };
};

describe("main, with the bundled schema", () => {
  test("exits 0 and counts the files when every definition is valid", async () => {
    expect(await run(VALID)).toEqual({
      code: 0,
      stdout: `All 3 definitions match ${BUNDLED}\n`,
      stderr: "",
    });
  });

  test("exits 1 and lists every invalid file", async () => {
    const { code, stdout, stderr } = await run(join(CORPUS, "invalid"));
    expect(code).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toContain(
      "✗ bad-kind.md\n    /kind must be equal to one of the allowed values\n",
    );
    expect(stderr).toEndWith(`\n9 of 9 definitions do not match ${BUNDLED}\n`);
  });

  test("exits 1 when the directory has no definitions", async () => {
    const directory = join(CORPUS, "empty");
    expect(await run(directory)).toEqual({
      code: 1,
      stdout: "",
      stderr: `✗ (no files)\n    / no definitions found\n\nNo definitions found in ${directory}\n`,
    });
  });

  test("exits 2 when the directory does not exist", async () => {
    const directory = join(CORPUS, "missing");
    const { code, stderr } = await run(directory);
    expect(code).toBe(2);
    expect(stderr).toStartWith(`doc-check: cannot read ${directory}: `);
  });

  test("prints the usage text on --help", async () => {
    for (const flag of ["--help", "-h"]) {
      const { code, stdout } = await run(flag);
      expect(code).toBe(0);
      expect(stdout).toStartWith(
        "Usage: doc-check <definitions-directory> [schema]",
      );
    }
  });
});

describe("main, with a schema at a URL", () => {
  let server: SchemaServer;

  beforeAll(() => {
    server = serveSchemas();
  });

  afterAll(async () => {
    await server.stop();
  });

  test("checks against that schema and says so", async () => {
    const url = server.url("/schema.json");
    expect(await run(VALID, "--schema-url", url)).toEqual({
      code: 0,
      stdout: `All 3 definitions match the schema at ${url}\n`,
      stderr: "",
    });
  });

  test("fails the definitions that only that schema rejects", async () => {
    // Two of the three have no category, which the bundled schema allows.
    const url = server.url("/stricter.json");
    expect(await run(VALID, "--schema-url", url)).toEqual({
      code: 1,
      stdout: "",
      stderr: [
        "✗ minimal.md",
        "    / must have required property 'category'",
        "✗ yaml-lookalikes.md",
        "    / must have required property 'category'",
        "",
        `2 of 3 definitions do not match the schema at ${url}`,
        "",
      ].join("\n"),
    });
  });

  test("exits 2 when the schema cannot be fetched, and checks nothing", async () => {
    const url = server.url("/missing.json");
    expect(await run(VALID, "--schema-url", url)).toEqual({
      code: 2,
      stdout: "",
      stderr: `doc-check: Cannot fetch ${url}: HTTP 404\n`,
    });
  });

  test("exits 2 when what is served is not a schema", async () => {
    expect(
      (await run(VALID, "--schema-url", server.url("/page.html"))).stderr,
    ).toBe("doc-check: The schema is not JSON.\n");

    const unusable = await run(
      VALID,
      "--schema-url",
      server.url("/not-a-schema.json"),
    );
    expect(unusable.code).toBe(2);
    expect(unusable.stderr).toStartWith(
      "doc-check: The schema cannot be used: schema is invalid",
    );
  });
});

describe("main, with a schema in a Git repository", () => {
  let repository: SchemaRepository;
  const at = (ref: string): string[] => [
    "--schema-git",
    repository.directory,
    "--schema-ref",
    ref,
    "--schema-path",
    SCHEMA_PATH,
  ];

  beforeAll(() => {
    repository = createSchemaRepository();
  });

  afterAll(() => {
    repository.remove();
  });

  test("checks against the schema of a commit and names the commit", async () => {
    expect(await run(VALID, ...at(repository.firstCommit))).toEqual({
      code: 0,
      stdout: `All 3 definitions match the schema at ${repository.directory}@${repository.firstCommit}\n`,
      stderr: "",
    });
  });

  test("checks against the schema of a branch and names its commit", async () => {
    const { code, stdout } = await run(VALID, ...at("main"));
    expect(code).toBe(0);
    expect(stdout).toEndWith(`@${repository.mainCommit}\n`);
  });

  test("fails a definition that only the schema of that branch rejects", async () => {
    const { code, stderr } = await run(VALID, ...at("stricter"));
    expect(code).toBe(1);
    expect(stderr).toContain(
      "✗ minimal.md\n    / must have required property 'category'\n",
    );
  });

  test("exits 2 when the branch does not exist, and checks nothing", async () => {
    expect(await run(VALID, ...at("gone"))).toEqual({
      code: 2,
      stdout: "",
      stderr: `doc-check: Cannot read ${SCHEMA_PATH} at gone of ${repository.directory}: couldn't find remote ref gone\n`,
    });
  });
});

describe("parseArguments", () => {
  const errorOf = (...args: string[]): string | undefined => {
    const parsed = parseArguments(args);
    return "error" in parsed ? parsed.error : undefined;
  };

  test("defaults to the bundled schema", () => {
    expect(parseArguments(["definitions"])).toEqual({
      directory: "definitions",
      schema: { kind: "bundled" },
    });
  });

  test("reads a schema URL, before or after the directory", () => {
    const expected = {
      directory: "definitions",
      schema: { kind: "url", url: "https://example.com/schema.json" },
    } as const;
    expect(
      parseArguments([
        "definitions",
        "--schema-url",
        "https://example.com/schema.json",
      ]),
    ).toEqual(expected);
    expect(
      parseArguments([
        "--schema-url=https://example.com/schema.json",
        "definitions",
      ]),
    ).toEqual(expected);
  });

  test("reads a schema in Git", () => {
    expect(
      parseArguments([
        "definitions",
        "--schema-git",
        "https://github.com/supabase/supabase.git",
        "--schema-ref",
        "master",
        "--schema-path",
        "apps/docs/definition.schema.json",
      ]),
    ).toEqual({
      directory: "definitions",
      schema: {
        kind: "git",
        repository: "https://github.com/supabase/supabase.git",
        ref: "master",
        path: "apps/docs/definition.schema.json",
      },
    });
  });

  test("wants exactly one directory", () => {
    expect(errorOf()).toBe("Give one definitions directory.");
    expect(errorOf("a", "b")).toBe("Give one definitions directory.");
    expect(errorOf("--schema-url", "https://example.com/s.json")).toBe(
      "Give one definitions directory.",
    );
  });

  test("wants a URL that can be fetched", () => {
    for (const url of ["schema.json", "file:///schema.json", "ftp://a/b"]) {
      expect(errorOf("definitions", "--schema-url", url)).toBe(
        `--schema-url must be an http or https URL, not ${url}`,
      );
    }
  });

  test("wants all three parts of a Git source", () => {
    const together =
      "--schema-git, --schema-ref and --schema-path go together.";
    expect(errorOf("definitions", "--schema-git", "repo")).toBe(together);
    expect(errorOf("definitions", "--schema-ref", "main")).toBe(together);
    expect(
      errorOf("definitions", "--schema-git", "repo", "--schema-path", "s.json"),
    ).toBe(together);
  });

  test("wants one source, not two", () => {
    expect(
      errorOf(
        "definitions",
        "--schema-url",
        "https://example.com/s.json",
        "--schema-ref",
        "main",
      ),
    ).toBe("Give --schema-url or --schema-git, not both.");
  });

  test("rejects an option it does not know, and one without its value", () => {
    expect(errorOf("definitions", "--fix")).toContain("--fix");
    expect(errorOf("definitions", "--schema-url")).toContain("--schema-url");
    // A value that starts with a hyphen would be read by Git as an option.
    expect(errorOf("definitions", "--schema-ref", "--evil")).toContain(
      "--schema-ref",
    );
  });

  test("main prints the problem and the usage text, and exits 2", async () => {
    const { code, stdout, stderr } = await run("a", "b");
    expect(code).toBe(2);
    expect(stdout).toBe("");
    expect(stderr).toStartWith(
      "doc-check: Give one definitions directory.\n\nUsage: doc-check <definitions-directory> [schema]\n",
    );
  });
});
