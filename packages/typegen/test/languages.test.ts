import { describe, expect, test } from "bun:test";
import { findLanguage, languages } from "../src/index.ts";

describe("languages", () => {
  test("lists the four bundled generators followed by dart", () => {
    expect(languages.map((language) => language.name)).toEqual([
      "typescript",
      "go",
      "python",
      "swift",
      "dart",
    ]);
  });

  test("names are unique", () => {
    const names = languages.map((language) => language.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test("marks the bundled generators in-process and dart out-of-process", () => {
    expect(
      Object.fromEntries(
        languages.map((language) => [language.name, language.inProcess]),
      ),
    ).toEqual({
      typescript: true,
      go: true,
      python: true,
      swift: true,
      dart: false,
    });
  });

  test("keeps the flag names supabase gen types already exposes", () => {
    expect(findLanguage("typescript")?.options).toEqual([
      {
        name: "postgrest-v9-compat",
        kind: "boolean",
        default: false,
        help: "Generate types compatible with PostgREST v9 and below.",
      },
    ]);
    expect(findLanguage("swift")?.options).toEqual([
      {
        name: "swift-access-control",
        kind: "choice",
        choices: ["internal", "public"],
        default: "internal",
        help: "Access control for Swift generated types.",
      },
    ]);
    expect(findLanguage("go")?.options).toEqual([]);
    expect(findLanguage("python")?.options).toEqual([]);
    expect(findLanguage("dart")?.options).toEqual([]);
  });

  test("findLanguage returns undefined for an unknown name", () => {
    expect(findLanguage("cobol")).toBeUndefined();
  });
});
