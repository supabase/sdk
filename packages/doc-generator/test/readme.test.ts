import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { loadModel } from "../src/index.ts";
import { slugify } from "../src/slug.ts";
import { fixtures } from "./fixtures.ts";

const PACKAGE = join(import.meta.dir, "..");
const SOURCES = join(PACKAGE, "src", "sources");
const FIXTURES = join(import.meta.dir, "fixtures");
const README = join(PACKAGE, "README.md");

/** One folder per language below `src/sources`, each with a page. */
const languages = readdirSync(SOURCES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const pageOf = (language: string): string =>
  join(SOURCES, language, "README.md");

/** Whether a language has an adapter, and not only a placeholder page. */
const hasAdapter = (language: string): boolean =>
  readdirSync(join(SOURCES, language)).some((name) => name.endsWith(".ts"));

/**
 * The code blocks of a page that show a fixture file. A comment names the
 * file: `<!-- fixture: <path below test/fixtures> -->`, then the block.
 */
const fixturesShown = (page: string): { path: string; block: string }[] =>
  [
    ...readFileSync(page, "utf8").matchAll(
      /<!-- fixture: (\S+) -->\n\n(`{3,})\w*\n([\s\S]*?)\n\2\n/g,
    ),
  ].map(([, path = "", , block = ""]) => ({ path, block }));

/**
 * The code blocks of a page that show part of a fixture file: a source or a
 * generated definition. `<!-- fixture excerpt: <path> -->`, then the block.
 */
const excerptsShown = (page: string): { path: string; block: string }[] =>
  [
    ...readFileSync(page, "utf8").matchAll(
      /<!-- fixture excerpt: (\S+) -->\n\n(`{3,})\w*\n([\s\S]*?)\n\2\n/g,
    ),
  ].map(([, path = "", , block = ""]) => ({ path, block }));

/**
 * Fails unless every line of `block` is in `file`, in the same order. Indents,
 * bodies and blank lines do not count, so a block can leave out what does not
 * matter to a reader.
 */
const expectShownInOrder = (path: string, block: string, file: string) => {
  const lines = file.split("\n").map(bare);
  let from = 0;
  for (const line of block.split("\n").map(bare).filter(Boolean)) {
    const found = lines.indexOf(line, from);
    if (found === -1) {
      throw new Error(
        `The page shows a line that ${path} does not have, or has earlier:\n${line}`,
      );
    }
    from = found + 1;
  }
  expect(from).toBeGreaterThan(0);
};

/**
 * The rows of the table of ids on a page: how the page shows a function, its
 * name, and its id. A comment marks the table: `<!-- ids: <fixture> -->`.
 */
const idsShown = (page: string, fixture: string): string[][] => {
  const [, table = ""] =
    new RegExp(`<!-- ids: ${fixture} -->\\n\\n((?:\\|.*\\n)+)`).exec(
      readFileSync(page, "utf8"),
    ) ?? [];
  return table
    .trimEnd()
    .split("\n")
    .slice(2) // The header and the line below it.
    .map((row) =>
      row
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim().replace(/^`|`$/g, "")),
    );
};

/** A line without its indent and without the brace that opens a body. */
const bare = (line: string): string => line.trim().replace(/\s*\{$/, "");

/** The anchor GitHub gives a heading. */
const anchorOf = (heading: string): string =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s/g, "-");

const anchorsOf = (file: string): string[] =>
  [...readFileSync(file, "utf8").matchAll(/^#+ (.+)$/gm)].map(
    ([, heading = ""]) => anchorOf(heading),
  );

describe("the pages on writing doc comments", () => {
  test("there is one for each language, next to its adapter", () => {
    expect(languages).toEqual([
      "csharp",
      "dart",
      "go",
      "javascript",
      "kotlin",
      "python",
      "swift",
    ]);
    for (const language of languages) {
      expect(existsSync(pageOf(language))).toBe(true);
    }
  });

  test("the package README links to every one of them", () => {
    const readme = readFileSync(README, "utf8");
    for (const language of languages) {
      expect(readme).toContain(`(src/sources/${language}/README.md)`);
    }
  });

  test("a language with an adapter shows its example, the others say they have none", () => {
    const shown = Object.fromEntries(
      languages.map((language) => [
        language,
        fixturesShown(pageOf(language)).map(({ path }) => path),
      ]),
    );
    expect(shown).toEqual({
      csharp: [],
      dart: [],
      go: [],
      javascript: [],
      kotlin: [],
      python: [
        "python/package/src/notes/sharing.py",
        "python/expected/notes-sharing-sharing-client-share.md",
      ],
      swift: [
        "swift/package/Sources/Notes/Sharing.swift",
        "swift/expected/notes-client-share.md",
      ],
    });
    // A page turns from placeholder into example when its adapter arrives.
    for (const language of languages) {
      const page = readFileSync(pageOf(language), "utf8");
      expect([language, page.includes("Not supported yet.")]).toEqual([
        language,
        !hasAdapter(language),
      ]);
      expect([language, (shown[language] ?? []).length > 0]).toEqual([
        language,
        hasAdapter(language),
      ]);
    }
  });
});

describe("the examples on the pages", () => {
  for (const language of languages) {
    for (const { path, block } of fixturesShown(pageOf(language))) {
      const file = readFileSync(join(FIXTURES, path), "utf8");

      if (path.includes("/expected/")) {
        // What the generator writes for the source above, byte for byte. The
        // golden test keeps the file equal to what the generator writes.
        test(`${path} is shown as generated`, () => {
          expect(`${block}\n`).toBe(file);
        });
        continue;
      }

      // A source is shown without what does not matter to a reader: the
      // indent of an enclosing type, bodies, initializers.
      test(`${path} is shown as written`, () => {
        expectShownInOrder(path, block, file);
      });
    }

    // The entries of a lookup show part of a source, or of what the
    // generator writes for it.
    for (const [position, { path, block }] of excerptsShown(
      pageOf(language),
    ).entries()) {
      test(`excerpt ${position + 1} of ${language} is in ${path}`, () => {
        expectShownInOrder(
          path,
          block,
          readFileSync(join(FIXTURES, path), "utf8"),
        );
      });
    }
  }
});

describe("the ids on the pages", () => {
  for (const fixture of fixtures) {
    const functions = loadModel(
      fixture.config.source,
      fixture.directory,
    ).symbols.filter((symbol) => symbol.kind === "callable");
    const rows = idsShown(pageOf(fixture.name), fixture.name);

    test(`the ${fixture.name} page shows more than one`, () => {
      expect(rows.length).toBeGreaterThan(1);
    });

    for (const [shown = "", name = "", id = ""] of rows) {
      test(`${name} is ${id}`, () => {
        // The first column is how a reader knows the function: its symbol
        // in Swift, the path it is defined at in Python.
        expect(
          functions
            .filter((candidate) => candidate.name === name)
            .some(
              (candidate) =>
                candidate.symbol === shown || candidate.id === shown,
            ),
        ).toBe(true);
        expect(slugify(name)).toBe(id);
        // The generator wrote that file, unless the fixture's config
        // leaves the function out.
        expect(
          existsSync(
            join(fixture.directory, fixture.config.output, `${id}.md`),
          ),
        ).toBe(!fixture.excluded.includes(name));
      });
    }
  }
});

describe("the links between the README files", () => {
  for (const file of [README, ...languages.map(pageOf)]) {
    test(`${relative(PACKAGE, file)} links only to what exists`, () => {
      const links = [...readFileSync(file, "utf8").matchAll(/\]\(([^)\s]+)\)/g)]
        .map(([, target = ""]) => target)
        .filter((target) => !/^[a-z]+:/.test(target));
      expect(links.length).toBeGreaterThan(0);

      for (const link of links) {
        const [path = "", anchor] = link.split("#");
        const target = path === "" ? file : join(dirname(file), path);
        if (!existsSync(target)) {
          throw new Error(`${link} points at a file that does not exist`);
        }
        if (anchor !== undefined && !anchorsOf(target).includes(anchor)) {
          throw new Error(`${link} points at a heading that does not exist`);
        }
      }
    });
  }
});
