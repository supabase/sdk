import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { relative } from "node:path";
import {
  BUNDLED_SCHEMA,
  readBundledSchema,
  readSchema,
  SchemaError,
  type SchemaSource,
} from "../src/index.ts";
import {
  createSchemaRepository,
  SCHEMA_PATH,
  type SchemaRepository,
  type SchemaServer,
  serveSchemas,
  stricterSchema,
} from "./helpers.ts";

type GitSource = Extract<SchemaSource, { kind: "git" }>;

/** The message of the `SchemaError` that reading `source` fails with. */
const failure = async (source: SchemaSource): Promise<string> => {
  try {
    await readSchema(source);
  } catch (error) {
    if (error instanceof SchemaError) {
      return error.message;
    }
    throw error;
  }
  throw new Error("expected the schema not to be readable");
};

describe("the bundled schema", () => {
  // A formatter or a hand edit that changes the file fails here, so the copy
  // stays the one the docs team published.
  test("is the upstream file, byte for byte", () => {
    const sha256 = createHash("sha256")
      .update(readBundledSchema())
      .digest("hex");
    expect(sha256).toBe(BUNDLED_SCHEMA.sha256);
  });

  test("is closed, so the check rejects fields the docs site would reject", () => {
    const schema = JSON.parse(readBundledSchema()) as {
      additionalProperties: boolean;
      required: string[];
    };
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(["id", "kind", "title", "summary"]);
  });

  test("is what a check reads unless it is told otherwise", async () => {
    expect(await readSchema({ kind: "bundled" })).toEqual({
      text: readBundledSchema(),
      description: "the bundled schema (supabase/supabase@7fba2c3)",
    });
  });
});

describe("a schema at a URL", () => {
  let server: SchemaServer;

  beforeAll(() => {
    server = serveSchemas();
  });

  afterAll(async () => {
    await server.stop();
  });

  test("is fetched", async () => {
    const url = server.url("/stricter.json");
    expect(await readSchema({ kind: "url", url })).toEqual({
      text: stricterSchema(),
      description: `the schema at ${url}`,
    });
  });

  test("is found through a redirect", async () => {
    const schema = await readSchema({
      kind: "url",
      url: server.url("/moved.json"),
    });
    expect(schema.text).toBe(readBundledSchema());
  });

  test("fails with the status when the server does not have it", async () => {
    const url = server.url("/missing.json");
    expect(await failure({ kind: "url", url })).toBe(
      `Cannot fetch ${url}: HTTP 404`,
    );
  });

  test("fails with the reason when the server cannot be reached", async () => {
    const closed = serveSchemas();
    const url = closed.url("/schema.json");
    await closed.stop();
    expect(await failure({ kind: "url", url })).toStartWith(
      `Cannot fetch ${url}: `,
    );
  });
});

describe("a schema in a Git repository", () => {
  let repository: SchemaRepository;
  const at = (ref: string, path = SCHEMA_PATH): GitSource => ({
    kind: "git",
    repository: repository.directory,
    ref,
    path,
  });

  beforeAll(() => {
    repository = createSchemaRepository();
  });

  afterAll(() => {
    repository.remove();
  });

  test("is read at a branch, and reported with the commit the branch is at", async () => {
    expect(await readSchema(at("main"))).toEqual({
      text: readBundledSchema(),
      description: `the schema at ${repository.directory}@${repository.mainCommit}`,
    });
  });

  test("is the one of that branch, not of the default branch", async () => {
    expect((await readSchema(at("stricter"))).text).toBe(stricterSchema());
  });

  test("is read at a commit that no branch points at", async () => {
    expect(await readSchema(at(repository.firstCommit))).toEqual({
      text: readBundledSchema(),
      description: `the schema at ${repository.directory}@${repository.firstCommit}`,
    });
  });

  test("is read at a tag", async () => {
    const schema = await readSchema(at("v1"));
    expect(schema.description).toEndWith(`@${repository.firstCommit}`);
  });

  test("is read from a repository given by a relative path", async () => {
    const source: SchemaSource = {
      kind: "git",
      repository: relative(process.cwd(), repository.directory),
      ref: "main",
      path: SCHEMA_PATH,
    };
    expect((await readSchema(source)).text).toBe(readBundledSchema());
  });

  test("is read from the temporary repository even inside a Git hook", async () => {
    // Git sets these for a hook, pointing at the repository being committed to.
    const hook = {
      ...process.env,
      GIT_DIR: "/nonexistent/.git",
      GIT_INDEX_FILE: "/nonexistent/.git/index",
      GIT_OBJECT_DIRECTORY: "/nonexistent/.git/objects",
      GIT_WORK_TREE: "/nonexistent",
    };
    expect((await readSchema(at("main"), hook)).text).toBe(readBundledSchema());
  });

  test("fails with a plain message when git is not installed", async () => {
    try {
      await readSchema(at("main"), { PATH: "/nonexistent" });
      throw new Error("expected the schema not to be readable");
    } catch (error) {
      expect((error as Error).message).toEndWith(": git is not installed");
    }
  });

  test("fails when the repository has no such branch", async () => {
    expect(await failure(at("no-such-branch"))).toBe(
      `Cannot read ${SCHEMA_PATH} at no-such-branch of ${repository.directory}: couldn't find remote ref no-such-branch`,
    );
  });

  test("fails when the commit has no such file", async () => {
    expect(await failure(at("main", "docs/other.json"))).toBe(
      `Cannot read docs/other.json at main of ${repository.directory}: path 'docs/other.json' does not exist in 'FETCH_HEAD'`,
    );
  });

  test("fails when there is no such repository", async () => {
    const source: SchemaSource = {
      ...at("main"),
      repository: "/nonexistent/repository",
    };
    expect(await failure(source)).toStartWith(
      `Cannot read ${SCHEMA_PATH} at main of /nonexistent/repository: `,
    );
  });

  test("refuses a value that Git would read as an option", async () => {
    expect(await failure(at("--upload-pack=touch /tmp/owned"))).toEndWith(
      '"--upload-pack=touch /tmp/owned" starts with -',
    );
    expect(await failure(at("main", "-x"))).toEndWith('"-x" starts with -');
    expect(await failure({ ...at("main"), repository: "--help" })).toEndWith(
      '"--help" starts with -',
    );
  });

  test("leaves no temporary repository behind", async () => {
    const left = (): string[] =>
      readdirSync(tmpdir()).filter((name) =>
        name.startsWith("doc-check-schema-"),
      );
    const before = left();
    await readSchema(at("main"));
    await failure(at("no-such-branch"));
    expect(left()).toEqual(before);
  });
});
