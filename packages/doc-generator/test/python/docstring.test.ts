import { describe, expect, test } from "bun:test";
import {
  type DocstringSection,
  parseDocstring,
} from "../../src/sources/python/docstring.ts";

/** A docstring as griffe dumps it, from its sections. */
const parse = (...parsed: DocstringSection[]) =>
  parseDocstring({ value: "", parsed });

const text = (value: string): DocstringSection => ({ kind: "text", value });

describe("parseDocstring", () => {
  test("takes the summary and the description from the text", () => {
    const doc = parse(
      text("Creates a note\nwith a title.\n\nIt is stored at once."),
    );
    expect(doc.summary).toBe("Creates a note with a title.");
    expect(doc.description).toBe(
      "Creates a note\nwith a title.\n\nIt is stored at once.",
    );
  });

  test("describes parameters, on one line each", () => {
    const doc = parse(
      text("S."),
      {
        kind: "parameters",
        value: [
          { name: "title", description: "The title\nof the note." },
          { name: "body", description: "" },
          { description: "An entry without a name is skipped." },
        ],
      },
      {
        kind: "other parameters",
        value: [{ name: "retries", description: "How often to retry." }],
      },
    );
    expect([...doc.parameters]).toEqual([
      ["title", "The title of the note."],
      ["body", ""],
      ["retries", "How often to retry."],
    ]);
  });

  test("matches variadic parameters written with their stars", () => {
    const doc = parse(text("S."), {
      kind: "parameters",
      value: [
        { name: "*tags", description: "Tags." },
        { name: "**metadata", description: "Anything else." },
      ],
    });
    expect([...doc.parameters.keys()]).toEqual(["tags", "metadata"]);
  });

  test("describes what a function returns or yields", () => {
    expect(
      parse(text("S."), {
        kind: "returns",
        value: [
          { name: "", description: "The stored note.\n" },
          { description: " " },
        ],
      }).returns,
    ).toBe("The stored note.");
    expect(
      parse(text("S."), {
        kind: "yields",
        value: [{ description: "One note at a time." }],
      }).returns,
    ).toBe("One note at a time.");
    expect(parse(text("S.")).returns).toBeUndefined();
  });

  test("lists what a function raises, with and without a type", () => {
    const doc = parse(text("S."), {
      kind: "raises",
      value: [
        {
          annotation: { cls: "ExprName", name: "NotesError" },
          description: "If rejected.",
        },
        { annotation: "`ValueError`", description: "If the title\nis empty." },
        { annotation: null, description: "When offline." },
        {},
      ],
    });
    expect(doc.throws).toEqual([
      { type: "NotesError", description: "If rejected." },
      { type: "ValueError", description: "If the title is empty." },
      { description: "When offline." },
      { description: "" },
    ]);
  });

  test("keeps a section such as Note or Warning in the description, as a quote", () => {
    const doc = parse(
      text("Shares a note."),
      {
        kind: "admonition",
        title: "Warning",
        value: {
          annotation: "warning",
          description: "Anyone with the link\ncan read it.",
        },
      },
      {
        kind: "admonition",
        title: null,
        value: { annotation: "see-also", description: "share" },
      },
      text("More text."),
    );
    expect(doc.description).toBe(
      [
        "Shares a note.",
        "",
        "> **Warning:** Anyone with the link",
        "> can read it.",
        "",
        "> **see-also:** share",
        "",
        "More text.",
      ].join("\n"),
    );
    expect(doc.summary).toBe("Shares a note.");
  });

  test("takes examples from an Examples section only, each titled by the paragraph above it", () => {
    const doc = parse(
      text("Adds numbers.\n\n```python\nadd(1, 2)\n```\n\n>>> add(1, 1)\n2"),
      {
        kind: "examples",
        value: [
          [
            "text",
            "In a console:\n\n```pycon\n>>> add(2, 2)\n4\n```\n\nTwice:",
          ],
          ["examples", ">>> add(3, 3)\n6"],
          ["examples", ">>> add(4, 4)\n8"],
          ["text", "Both give the sum."],
          ["unknown"],
        ],
      },
    );
    expect(doc.examples).toEqual([
      { title: "In a console", lang: "pycon", code: ">>> add(2, 2)\n4" },
      { title: "Twice", lang: "python", code: ">>> add(3, 3)\n6" },
      { lang: "python", code: ">>> add(4, 4)\n8" },
    ]);
    // Code outside the section is part of the text, a doctest there fenced so
    // that it shows as code. Text in the section that titles nothing stays.
    expect(doc.description).toBe(
      [
        "Adds numbers.",
        "",
        "```python",
        "add(1, 2)",
        "```",
        "",
        "```python",
        ">>> add(1, 1)",
        "2",
        "```",
        "",
        "Both give the sum.",
      ].join("\n"),
    );
  });

  test("keeps code in other languages in the description, in an Examples section too", () => {
    const doc = parse(text('Answers with:\n\n```json\n{ "ok": true }\n```'), {
      kind: "examples",
      value: [["text", "Or:\n\n```json\n{}\n```"]],
    });
    expect(doc.examples).toEqual([]);
    expect(doc.description).toBe(
      'Answers with:\n\n```json\n{ "ok": true }\n```\n\nOr:\n\n```json\n{}\n```',
    );
  });

  test("leaves out sections about something other than the call", () => {
    const doc = parse(
      text("S."),
      {
        kind: "attributes",
        value: [{ name: "x", description: "An attribute." }],
      },
      {
        kind: "warns",
        value: [{ annotation: "UserWarning", description: "Sometimes." }],
      },
      {
        kind: "deprecated",
        value: { annotation: "2.0", description: "Use other." },
      },
      { kind: "text", value: 3 },
      { kind: "admonition", value: "not an entry" },
      { kind: "examples", value: "not a list" },
      { kind: "parameters", value: "not a list" },
    );
    expect(doc).toEqual({
      summary: "S.",
      description: "S.",
      parameters: new Map(),
      throws: [],
      examples: [],
    });
  });

  test("reads the raw text when the dump has no sections", () => {
    const doc = parseDocstring({
      value: "Deletes a note.\n\n:param id: The id.",
    });
    expect(doc.summary).toBe("Deletes a note.");
    expect([...doc.parameters]).toEqual([]);
  });

  test("is empty for a function without a docstring", () => {
    expect(parseDocstring(undefined)).toEqual({
      summary: "",
      description: "",
      parameters: new Map(),
      throws: [],
      examples: [],
    });
  });
});
