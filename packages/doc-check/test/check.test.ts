import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkDefinitionFile,
  checkDefinitions,
  checkDirectory,
  compileSchema,
  parseFrontmatter,
  SchemaError,
} from "../src/index.ts";
import { stricterSchema } from "./helpers.ts";

const CORPUS = join(import.meta.dir, "corpus");

const read = (folder: string, name: string) => ({
  name,
  text: readFileSync(join(CORPUS, folder, name), "utf8"),
});

/** `path message` per problem, the way the command line prints them. */
const problemsOf = (folder: string, name: string): string[] =>
  checkDefinitionFile(read(folder, name)).map(
    (problem) => `${problem.path} ${problem.message}`,
  );

describe("valid corpus", () => {
  for (const name of readdirSync(join(CORPUS, "valid"))) {
    test(name, () => {
      expect(problemsOf("valid", name)).toEqual([]);
    });
  }

  test("values that look like other YAML types stay strings when quoted", () => {
    const parsed = parseFrontmatter(read("valid", "yaml-lookalikes.md").text);
    expect(parsed).toEqual({
      ok: true,
      data: {
        id: "yaml-lookalikes",
        kind: "constant",
        title: "no",
        summary: "on",
        since: "2026-01-01",
        parameters: [
          {
            name: "mode",
            default: "0o644",
            allowed_values: ["yes", "no", 1, true],
          },
        ],
      },
    });
  });
});

describe("invalid corpus", () => {
  // The four ways the docs team's guide says a check must be seen to fail.
  test("a kind outside the enum", () => {
    expect(problemsOf("invalid", "bad-kind.md")).toEqual([
      "/kind must be equal to one of the allowed values",
    ]);
  });

  test("an unknown key", () => {
    expect(problemsOf("invalid", "unknown-key.md")).toEqual([
      "/ must NOT have additional properties: overloads",
    ]);
  });

  test("an id that differs from the file name", () => {
    expect(problemsOf("invalid", "renamed-id.md")).toEqual([
      '/id id "another-id" does not match the file name',
    ]);
  });

  test("a missing required key", () => {
    expect(problemsOf("invalid", "missing-summary.md")).toEqual([
      "/ must have required property 'summary'",
    ]);
  });

  test("no frontmatter", () => {
    expect(problemsOf("invalid", "no-frontmatter.md")).toEqual([
      "/ missing YAML frontmatter",
    ]);
  });

  test("frontmatter that is not YAML", () => {
    const problems = problemsOf("invalid", "broken-yaml.md");
    expect(problems).toHaveLength(1);
    expect(problems[0]).toStartWith("/ invalid YAML frontmatter: ");
  });

  test("a repeated example id", () => {
    expect(problemsOf("invalid", "duplicate-example-ids.md")).toEqual([
      '/examples example id "basic" is used more than once',
    ]);
  });

  test("a bare date, which the docs site's parser reads as a timestamp", () => {
    expect(problemsOf("invalid", "unquoted-date.md")).toEqual([
      "/since must be string",
    ]);
  });

  test("a file name and id that are not lowercase words", () => {
    expect(problemsOf("invalid", "Upper_Case.md")).toEqual([
      "/ file name must be lowercase words separated by hyphens",
      '/id must match pattern "^[a-z0-9]+(?:-[a-z0-9]+)*$"',
    ]);
  });

  test("every file in the folder is covered and fails", () => {
    const result = checkDirectory(join(CORPUS, "invalid"));
    const failing = new Set(result.problems.map((problem) => problem.file));
    expect(result.files).toBe(9);
    expect(failing.size).toBe(9);
  });
});

describe("checkDefinitionFile", () => {
  test("reports every problem of a file, not only the first", () => {
    const problems = checkDefinitionFile({
      name: "two-problems.md",
      text: "---\nid: other\nkind: nope\ntitle: t\nsummary: s\n---\n",
    });
    expect(problems.map((problem) => problem.path)).toEqual(["/kind", "/id"]);
  });

  test("reads CRLF files", () => {
    const text = read("valid", "minimal.md").text.replaceAll("\n", "\r\n");
    expect(checkDefinitionFile({ name: "minimal.md", text })).toEqual([]);
  });

  test("rejects frontmatter that is not a mapping", () => {
    const problems = checkDefinitionFile({
      name: "list.md",
      text: "---\n- a\n- b\n---\n",
    });
    expect(problems.map((problem) => problem.message)).toEqual([
      "must be object",
    ]);
  });
});

describe("checkDefinitions", () => {
  test("an empty set is a problem, so a silent empty run cannot pass", () => {
    expect(checkDefinitions([])).toEqual({
      files: 0,
      problems: [{ file: "", path: "/", message: "no definitions found" }],
    });
  });
});

describe("compileSchema", () => {
  test("gives a check that reports against that schema, not the bundled one", () => {
    const stricter = compileSchema(stricterSchema());
    const minimal = read("valid", "minimal.md");
    expect(checkDefinitionFile(minimal)).toEqual([]);
    expect(checkDefinitionFile(minimal, stricter)).toEqual([
      {
        file: "minimal.md",
        path: "/",
        message: "must have required property 'category'",
      },
    ]);
    expect(checkDefinitions([minimal], stricter).problems).toHaveLength(1);
    expect(checkDirectory(join(CORPUS, "valid"), stricter).problems).toEqual([
      {
        file: "minimal.md",
        path: "/",
        message: "must have required property 'category'",
      },
      {
        file: "yaml-lookalikes.md",
        path: "/",
        message: "must have required property 'category'",
      },
    ]);
  });

  test("keeps the checks a schema cannot express", () => {
    const anything = compileSchema("{}");
    expect(
      checkDefinitionFile(read("invalid", "renamed-id.md"), anything),
    ).toEqual([
      {
        file: "renamed-id.md",
        path: "/id",
        message: 'id "another-id" does not match the file name',
      },
    ]);
  });

  test("rejects text that is not JSON", () => {
    expect(() => compileSchema("<html>Not found</html>")).toThrow(
      new SchemaError("The schema is not JSON."),
    );
  });

  test("rejects JSON that is not a schema", () => {
    expect(() => compileSchema('{ "type": "nope" }')).toThrow(SchemaError);
    expect(() => compileSchema('"a string"')).toThrow(
      /^The schema cannot be used: /,
    );
  });

  test("rejects a schema with a keyword it does not know, rather than skip it", () => {
    expect(() =>
      compileSchema('{ "type": "object", "futureKeyword": true }'),
    ).toThrow(/^The schema cannot be used: .*futureKeyword/);
  });
});

describe("checkDirectory", () => {
  test("passes the valid corpus", () => {
    expect(checkDirectory(join(CORPUS, "valid"))).toEqual({
      files: 3,
      problems: [],
    });
  });

  test("ignores files that are not Markdown", () => {
    expect(checkDirectory(join(CORPUS, "empty")).files).toBe(0);
  });
});
