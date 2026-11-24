import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseFrontmatter } from "@supabase/doc-check";
import {
  GeneratorError,
  placeholderIndex,
  previewDefinitions,
  type PreviewInput,
} from "../src/index.ts";

const definition = (id: string, summary = "S."): string =>
  `---\nid: "${id}"\nkind: "method"\ntitle: "t"\nsummary: "${summary}"\n---\n`;

let root: string;
/** The folder a generator wrote to. */
let definitions: string;
/** A checkout of supabase/supabase, as far as a preview looks at it. */
let docs: string;
/** Where the docs site keeps its libraries. */
let content: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "doc-generator-preview-")));
  definitions = join(root, "sdk", "docs", "api-docs", "definitions");
  docs = join(root, "supabase");
  content = join(docs, "apps", "docs", "content", "reference-beta");
  mkdirSync(definitions, { recursive: true });
  mkdirSync(content, { recursive: true });
  writeFileSync(
    join(definitions, "auth-sign-up.md"),
    definition("auth-sign-up"),
  );
  writeFileSync(
    join(definitions, "auth-sign-out.md"),
    definition("auth-sign-out"),
  );
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const input = (overrides: Partial<PreviewInput> = {}): PreviewInput => ({
  definitions,
  docs,
  preview: { path: "swift", title: "Swift" },
  language: "swift",
  ...overrides,
});

describe("previewDefinitions", () => {
  test("copies the definitions to where the docs site reads them", () => {
    const result = previewDefinitions(input());
    const target = join(content, "swift", "definitions");
    expect(result).toEqual({
      directory: target,
      definitions: 2,
      index: join(content, "swift", "index.md"),
      url: "http://localhost:3001/docs/reference-beta/swift",
    });
    expect(readdirSync(target).sort()).toEqual([
      "auth-sign-out.md",
      "auth-sign-up.md",
    ]);
    expect(readFileSync(join(target, "auth-sign-up.md"), "utf8")).toBe(
      definition("auth-sign-up"),
    );
  });

  test("writes a placeholder introduction the docs site can read", () => {
    previewDefinitions(
      input({ preview: { path: "swift", title: 'Swift: "v3"' } }),
    );
    const index = readFileSync(join(content, "swift", "index.md"), "utf8");
    expect(index).toBe(placeholderIndex('Swift: "v3"', "swift"));
    // Only keys the docs site's schema for this file has, read as it reads them.
    expect(parseFrontmatter(index)).toEqual({
      ok: true,
      data: { title: 'Swift: "v3"', code_lang: "swift" },
    });
  });

  test("leaves an introduction that is already there alone", () => {
    const index = join(content, "swift", "index.md");
    mkdirSync(join(content, "swift"));
    writeFileSync(
      index,
      "---\ntitle: Swift\nicon: reference-swift\n---\n\nReal.\n",
    );
    const result = previewDefinitions(input());
    expect(result.index).toBeUndefined();
    expect(readFileSync(index, "utf8")).toBe(
      "---\ntitle: Swift\nicon: reference-swift\n---\n\nReal.\n",
    );
  });

  test("replaces the definitions of the preview before", () => {
    previewDefinitions(input());
    rmSync(join(definitions, "auth-sign-out.md"));
    writeFileSync(
      join(definitions, "auth-sign-up.md"),
      definition("auth-sign-up", "New."),
    );
    writeFileSync(
      join(definitions, "auth-verify.md"),
      definition("auth-verify"),
    );

    const result = previewDefinitions(input());
    const target = join(content, "swift", "definitions");
    expect(result.definitions).toBe(2);
    expect(result.index).toBeUndefined();
    expect(readdirSync(target).sort()).toEqual([
      "auth-sign-up.md",
      "auth-verify.md",
    ]);
    expect(readFileSync(join(target, "auth-sign-up.md"), "utf8")).toBe(
      definition("auth-sign-up", "New."),
    );
  });

  test("mounts a version below its library", () => {
    const result = previewDefinitions(
      input({
        preview: { path: "python/v3", title: "Python" },
        language: "python",
      }),
    );
    expect(result.url).toBe(
      "http://localhost:3001/docs/reference-beta/python/v3",
    );
    expect(readdirSync(join(content, "python", "v3")).sort()).toEqual([
      "definitions",
      "index.md",
    ]);
  });

  test("touches nothing else in the docs checkout", () => {
    mkdirSync(join(content, "server", "definitions"), { recursive: true });
    writeFileSync(
      join(content, "server", "index.md"),
      "---\ntitle: Server\n---\n",
    );
    writeFileSync(
      join(content, "server", "definitions", "server-with.md"),
      definition("server-with"),
    );
    previewDefinitions(input());
    expect(readdirSync(content).sort()).toEqual(["server", "swift"]);
    expect(readdirSync(join(content, "server", "definitions"))).toEqual([
      "server-with.md",
    ]);
  });

  test("refuses a folder that is not a checkout with the reference pages", () => {
    const elsewhere = join(root, "elsewhere");
    mkdirSync(elsewhere);
    for (const wrong of [elsewhere, join(root, "missing")]) {
      expect(() => previewDefinitions(input({ docs: wrong }))).toThrow(
        new GeneratorError(
          `${wrong} has no apps/docs/content/reference-beta. Give a checkout of supabase/supabase on a branch that has the new reference pages.`,
        ),
      );
    }
    expect(readdirSync(elsewhere)).toEqual([]);
  });

  test("refuses to preview when nothing was generated", () => {
    const empty = join(root, "empty");
    mkdirSync(empty);
    writeFileSync(join(empty, "notes.txt"), "not a definition");
    for (const nothing of [empty, join(root, "missing")]) {
      expect(() => previewDefinitions(input({ definitions: nothing }))).toThrow(
        new GeneratorError(
          `There are no definitions in ${nothing}. Generate them first.`,
        ),
      );
    }
    expect(readdirSync(content)).toEqual([]);
  });
});
