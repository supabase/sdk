import { describe, expect, test } from "bun:test";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { checkDefinitions } from "@supabase/doc-check";
import {
  generate,
  type GenerateInput,
  loadModel,
  sourceLanguage,
} from "../src/index.ts";
import { fixtures } from "./fixtures.ts";

/**
 * `UPDATE_GOLDENS=1 bun test test/golden.test.ts` rewrites the expected
 * definitions instead of comparing with them. `bun run refresh-fixtures` does
 * that after it has rebuilt the tool output.
 */
const UPDATE = process.env.UPDATE_GOLDENS === "1";

const definitionFiles = (directory: string): string[] =>
  readdirSync(directory)
    .filter((name) => name.endsWith(".md"))
    .sort();

for (const fixture of fixtures) {
  describe(`${fixture.name} fixture`, () => {
    const expected = join(fixture.directory, fixture.config.output);
    const input: GenerateInput = {
      model: loadModel(fixture.config.source, fixture.directory),
      exclude: fixture.config.exclude ?? [],
      strict: fixture.config.strict ?? false,
    };
    const result = generate(input);

    if (UPDATE) {
      mkdirSync(expected, { recursive: true });
      for (const name of definitionFiles(expected)) {
        rmSync(join(expected, name));
      }
      for (const file of result.files) {
        writeFileSync(join(expected, file.name), file.content);
      }
    }

    test("knows its language without loading the model", () => {
      expect(sourceLanguage(fixture.config.source)).toBe(input.model.language);
    });

    test("writes one file per function, and no other", () => {
      expect(result.files.map((file) => file.name)).toEqual(
        definitionFiles(expected),
      );
    });

    for (const file of result.files) {
      test(`${file.name} is the expected file, byte for byte`, () => {
        expect(file.content).toBe(
          readFileSync(join(expected, file.name), "utf8"),
        );
      });
    }

    test("reports the functions it leaves out, and why", () => {
      expect(result.undocumented).toEqual([...fixture.undocumented]);
      expect(result.excluded).toEqual([...fixture.excluded]);
    });

    test("names every file after the function it documents", () => {
      // An id is the name in lowercase words, and nothing else goes into it.
      const names = new Set(
        input.model.symbols.flatMap((symbol) =>
          symbol.kind === "callable"
            ? [symbol.name.toLowerCase().replace(/[^a-z0-9]/g, "")]
            : [],
        ),
      );
      for (const file of result.files) {
        const id = file.name.slice(0, -".md".length);
        expect([id, names.has(id.replaceAll("-", ""))]).toEqual([id, true]);
      }
    });

    test("every definition passes the docs schema check", () => {
      const files = result.files.map((file) => ({
        name: file.name,
        text: file.content,
      }));
      expect(checkDefinitions(files)).toEqual({
        files: result.files.length,
        problems: [],
      });
    });

    test("a second run gives the same bytes", () => {
      expect(generate(input)).toEqual(result);
    });

    test("the order of the symbols does not matter", () => {
      const reversed = generate({
        ...input,
        model: {
          ...input.model,
          symbols: input.model.symbols.toReversed(),
        },
      });
      expect(reversed).toEqual(result);
    });
  });
}
