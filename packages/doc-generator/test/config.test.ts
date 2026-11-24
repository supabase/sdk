import { describe, expect, test } from "bun:test";
import { defineConfig, GeneratorError, parseConfig } from "../src/index.ts";
import { fixtures } from "./fixtures.ts";

const swift = {
  source: {
    format: "swift-symbol-graph",
    directory: ".build/symbol-graphs",
    modules: ["Auth"],
  },
  output: "docs/api-docs/definitions",
};

const problemsOf = (config: unknown): readonly string[] => {
  try {
    parseConfig(config);
  } catch (error) {
    if (error instanceof GeneratorError) {
      return error.problems;
    }
    throw error;
  }
  return [];
};

describe("parseConfig", () => {
  test("accepts the configs of the fixtures", () => {
    for (const fixture of fixtures) {
      expect(parseConfig(fixture.config)).toBe(fixture.config);
    }
  });

  test("accepts a config without the optional keys", () => {
    expect(parseConfig(swift)).toEqual(defineConfig(swift as never));
    expect(
      problemsOf({ ...swift, source: { format: "griffe", file: "api.json" } }),
    ).toEqual([]);
  });

  test("rejects anything that is not an object", () => {
    expect(problemsOf(undefined)).toEqual(["The config must be an object"]);
    expect(problemsOf([swift])).toEqual(["The config must be an object"]);
  });

  test("lists every missing key", () => {
    expect(problemsOf({})).toEqual([
      "source is required",
      "output is required",
    ]);
  });

  test("rejects an unknown key, which is nearly always a typo", () => {
    expect(problemsOf({ ...swift, outptu: "x" })).toEqual([
      "outptu is not a known option",
    ]);
    expect(
      problemsOf({ ...swift, source: { ...swift.source, module: ["Auth"] } }),
    ).toEqual(["source.module is not a known option"]);
  });

  test("rejects an unknown source format and names the known ones", () => {
    expect(problemsOf({ ...swift, source: { format: "typedoc" } })).toEqual([
      "source.format must be one of: swift-symbol-graph, griffe",
    ]);
    expect(problemsOf({ ...swift, source: "symbol-graphs" })).toEqual([
      "source.format must be one of: swift-symbol-graph, griffe",
    ]);
  });

  test("rejects an option of another format", () => {
    expect(
      problemsOf({
        ...swift,
        source: { ...swift.source, unwrapReturns: ["a.B"] },
      }),
    ).toEqual(["source.unwrapReturns is not a known option"]);
  });

  test("checks the type of every value", () => {
    expect(
      problemsOf({
        source: {
          format: "griffe",
          file: "",
          unwrapReturns: "a.B",
          symbolPaths: { "pkg.Client": 1 },
        },
        output: ["out"],
        exclude: "\\.init$",
        strict: "yes",
      }),
    ).toEqual([
      "source.file must be a non-empty string",
      "source.unwrapReturns must be a list of strings",
      "source.symbolPaths must map names to strings",
      "output must be a non-empty string",
      "exclude must be a list of strings",
      "strict must be true or false",
    ]);
  });

  test("accepts where the docs site shows the SDK, for a preview", () => {
    const preview = { path: "swift/v3", title: "Swift" };
    expect(parseConfig({ ...swift, preview }).preview).toEqual(preview);
  });

  test("wants both the path and the title of a preview", () => {
    expect(problemsOf({ ...swift, preview: {} })).toEqual([
      "preview.path is required",
      "preview.title is required",
    ]);
    expect(problemsOf({ ...swift, preview: "swift" })).toEqual([
      "preview must be an object",
    ]);
    expect(
      problemsOf({
        ...swift,
        preview: { path: "swift", title: "", icon: "x" },
      }),
    ).toEqual([
      "preview.icon is not a known option",
      "preview.title must be a non-empty string",
    ]);
  });

  test("rejects a preview path that could leave the docs site's folder", () => {
    for (const path of [
      "../guides",
      "/etc",
      "swift/..",
      "a//b",
      "",
      ".hidden",
      3,
    ]) {
      expect(
        problemsOf({ ...swift, preview: { path, title: "Swift" } }),
      ).toEqual([
        "preview.path must be a path of plain names, such as swift or swift/v3",
      ]);
    }
  });

  test("accepts the functions to leave out, as regular expressions", () => {
    const exclude = ["\\.init$", "^Async"];
    expect(parseConfig({ ...swift, exclude }).exclude).toEqual(exclude);
  });

  test("accepts strict mode, on or off", () => {
    expect(parseConfig({ ...swift, strict: true }).strict).toBe(true);
    expect(parseConfig({ ...swift, strict: false }).strict).toBe(false);
    expect(parseConfig(swift).strict).toBeUndefined();
  });

  test("rejects an exclusion that is not a regular expression", () => {
    expect(problemsOf({ ...swift, exclude: ["\\.init$", "("] })).toEqual([
      "exclude: ( is not a regular expression",
    ]);
  });

  test("rejects the options of the time a compliance file chose the functions", () => {
    expect(
      problemsOf({
        ...swift,
        compliance: "sdk-compliance.yaml",
        prefer: ["^Sync"],
      }),
    ).toEqual([
      "compliance is not a known option",
      "prefer is not a known option",
    ]);
  });
});
