import { describe, expect, test } from "bun:test";
import {
  InvalidOptionError,
  type OptionSpec,
  resolveOptions,
} from "../src/index.ts";

const specs: readonly OptionSpec[] = [
  { name: "flag", audience: "user", kind: "boolean", default: false, help: "" },
  {
    name: "level",
    audience: "user",
    kind: "choice",
    choices: ["a", "b"],
    default: "a",
    help: "",
  },
  { name: "label", audience: "consumer", kind: "string", help: "" },
];

describe("resolveOptions", () => {
  test("applies defaults and drops string options without a default", () => {
    expect(resolveOptions("lang", specs, {})).toEqual({
      flag: false,
      level: "a",
    });
  });

  test("keeps explicitly set values", () => {
    expect(
      resolveOptions("lang", specs, { flag: true, level: "b", label: "x" }),
    ).toEqual({ flag: true, level: "b", label: "x" });
  });

  test("treats an undefined value as unset", () => {
    expect(resolveOptions("lang", specs, { level: undefined })).toEqual({
      flag: false,
      level: "a",
    });
  });

  test("rejects unknown options", () => {
    expect(() => resolveOptions("lang", specs, { other: true })).toThrow(
      new InvalidOptionError({
        language: "lang",
        option: "other",
        message: 'Language "lang" has no option "other".',
      }),
    );
  });

  test("rejects a choice outside its choices", () => {
    let error: unknown;
    try {
      resolveOptions("lang", specs, { level: "c" });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(InvalidOptionError);
    expect((error as InvalidOptionError).option).toBe("level");
    expect((error as InvalidOptionError).language).toBe("lang");
    expect((error as InvalidOptionError).message).toBe(
      'Option "level" of language "lang" expects one of "a", "b", got "c".',
    );
  });

  test("rejects a value of the wrong type", () => {
    expect(() => resolveOptions("lang", specs, { flag: "yes" })).toThrow(
      InvalidOptionError,
    );
    expect(() => resolveOptions("lang", specs, { label: true })).toThrow(
      InvalidOptionError,
    );
  });
});
