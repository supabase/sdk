import { describe, expect, test } from "bun:test";
import { parseFrontmatter } from "@supabase/doc-check";
import { parse } from "yaml";
import type { Definition } from "../src/index.ts";
import { renderDefinitionFile } from "../src/frontmatter.ts";

const definition = (fields: Partial<Definition> = {}): Definition => ({
  id: "auth-sign-up",
  kind: "method",
  category: "auth",
  title: "signUp",
  symbol: "Auth.AuthClient.signUp(email:)",
  summary: "Creates a user.",
  description: "Creates a user.",
  signature: "func signUp(email: String) async throws",
  stability: "stable",
  deprecated: false,
  parameters: [],
  throws: [],
  examples: [],
  ...fields,
});

/** The frontmatter as the docs site reads it: gray-matter, YAML 1.1. */
const asDocsSiteReadsIt = (file: string): unknown => {
  const parsed = parseFrontmatter(file);
  return parsed.ok ? parsed.data : parsed.message;
};

/** The frontmatter as a YAML 1.2 parser reads it. */
const asYaml12ReadsIt = (file: string): unknown =>
  parse(file.slice(4, file.indexOf("\n---\n", 4) + 1));

describe("renderDefinitionFile", () => {
  test("writes the keys in schema order, whatever order they were set in", () => {
    expect(
      renderDefinitionFile(
        // The helper sets these after the keys the schema puts them before.
        definition({
          type_params: ["T"],
          parameters: [
            {
              variadic: true,
              allowed_values: ["a", 1, true],
              default: 3,
              description: "The user's email address.",
              required: true,
              type: "String",
              location: "argument",
              name: "email",
            },
          ],
          returns: { description: "The new session.", type: "Session" },
          throws: [{ description: "On failure.", type: "AuthError" }],
        }),
        "",
      ),
    ).toBe(`---
id: "auth-sign-up"
kind: "method"
category: "auth"
title: "signUp"
symbol: "Auth.AuthClient.signUp(email:)"
summary: "Creates a user."
description: "Creates a user."
signature: "func signUp(email: String) async throws"
type_params:
  - "T"
stability: "stable"
deprecated: false
parameters:
  - name: "email"
    location: "argument"
    type: "String"
    required: true
    description: "The user's email address."
    default: 3
    allowed_values:
      - "a"
      - 1
      - true
    variadic: true
returns:
  type: "Session"
  description: "The new session."
throws:
  - type: "AuthError"
    description: "On failure."
examples: []
---
`);
  });

  test("writes multi-line strings as literal blocks, never folded", () => {
    const long = `A ${"very ".repeat(40)}long line.`;
    const file = renderDefinitionFile(
      definition({
        description: `First paragraph.\n\n${long}`,
        examples: [
          {
            id: "example-1",
            title: "Example 1",
            lang: "swift",
            code: "let a = 1\n\nlet b = 2\n",
          },
        ],
      }),
      "",
    );
    expect(file).toContain(
      `description: |-\n  First paragraph.\n\n  ${long}\n`,
    );
    expect(file).toContain("    code: |\n      let a = 1\n\n      let b = 2\n");
    // The long one-line summary is not folded either.
    expect(renderDefinitionFile(definition({ summary: long }), "")).toContain(
      `summary: "${long}"\n`,
    );
  });

  test("puts the notes after the frontmatter, separated by a blank line", () => {
    expect(renderDefinitionFile(definition(), "Some notes.")).toEndWith(
      "examples: []\n---\n\nSome notes.\n",
    );
    expect(renderDefinitionFile(definition(), "")).toEndWith(
      "examples: []\n---\n",
    );
  });

  // Text from a doc comment can be anything. Whatever it is, both the docs
  // site's parser and a YAML 1.2 parser must read back exactly that text.
  const awkward: readonly string[] = [
    "yes",
    "no",
    "on",
    "off",
    "y",
    "true",
    "False",
    "null",
    "~",
    "",
    " ",
    "2026-01-01",
    "2026-01-01T10:00:00Z",
    "12:30:00",
    "1e3",
    "0x1F",
    "0o644",
    "0644",
    "1_000",
    ".inf",
    "-1",
    "3.14",
    "<<",
    "=",
    "key: value",
    "# not a comment",
    "- not a list",
    "[not, a, list]",
    "{not: a map}",
    "*alias",
    "&anchor",
    "!tag",
    "%directive",
    "@at",
    "`backticks`",
    '"double" quotes',
    "'single' quotes",
    "back\\slash",
    "tab\there",
    "  leading and trailing spaces  ",
    "ünïcödé — and “quotes”",
    "emoji 🎉",
    "trailing newline\n",
    "two trailing newlines\n\n",
    "\nleading newline",
    "  indented first line\nsecond line",
    "line one\n\n\nline four",
    "ends with spaces  \nnext",
    "---\nlooks like the end of the frontmatter\n---",
    "a\r\nb",
    "func f(a: Int = 1, b: [String: Int] = [:]) -> (Int) -> Void",
  ];

  for (const text of awkward) {
    test(`reads back ${JSON.stringify(text)} unchanged`, () => {
      const wanted = definition({
        summary: text,
        description: text,
        parameters: [
          {
            name: text,
            location: "argument",
            required: true,
            default: text,
            allowed_values: [text, 1, 1.5, true],
          },
        ],
        examples: [{ id: "a", title: text, lang: "swift", code: text }],
      });
      const file = renderDefinitionFile(wanted, text);
      expect(asDocsSiteReadsIt(file)).toEqual(wanted);
      expect(asYaml12ReadsIt(file)).toEqual(wanted);
    });
  }
});
