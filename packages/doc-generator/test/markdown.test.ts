import { describe, expect, test } from "bun:test";
import {
  extractCodeBlocks,
  extractTitledCodeBlocks,
  fenceDoctests,
  firstParagraph,
  mapProse,
  tidy,
  unwrap,
} from "../src/markdown.ts";

const lines = (...text: string[]): string => text.join("\n");

describe("tidy", () => {
  test("drops blank lines at both ends and trailing whitespace", () => {
    expect(tidy("\n\n  First.  \nSecond.\t\n\n")).toBe("  First.\nSecond.");
  });

  test("collapses runs of blank lines into one", () => {
    expect(tidy("One.\n\n\n\nTwo.")).toBe("One.\n\nTwo.");
  });

  test("leaves a code block exactly as written", () => {
    const code = lines("```swift", "let a = 1  ", "", "", "let b = 2", "```");
    expect(tidy(`Text.\n\n${code}\n`)).toBe(`Text.\n\n${code}`);
  });

  test("reads Windows line endings", () => {
    expect(tidy("One.\r\n\r\nTwo.\r\n")).toBe("One.\n\nTwo.");
  });

  test("is empty for an empty or blank text", () => {
    expect(tidy("")).toBe("");
    expect(tidy(" \n\t\n")).toBe("");
  });
});

describe("firstParagraph", () => {
  test("joins the wrapped lines of the first paragraph", () => {
    expect(firstParagraph("Creates a user\nwith a password.\n\nMore.")).toBe(
      "Creates a user with a password.",
    );
  });

  test("skips leading blank lines", () => {
    expect(firstParagraph("\n\nFirst.\n\nSecond.")).toBe("First.");
  });

  test("stops at a code block", () => {
    expect(firstParagraph("First.\n```swift\ncode()\n```")).toBe("First.");
  });

  test("is empty when there is no text", () => {
    expect(firstParagraph("")).toBe("");
    expect(firstParagraph("```swift\ncode()\n```")).toBe("");
  });
});

describe("unwrap", () => {
  test("joins the lines of a paragraph", () => {
    expect(unwrap("The user's\n  email address.")).toBe(
      "The user's email address.",
    );
  });

  test("keeps paragraphs apart", () => {
    expect(unwrap("One\nline.\n\nTwo\nlines.")).toBe("One line.\n\nTwo lines.");
  });

  test("keeps list items, quotes and headings on their own lines", () => {
    const text = lines(
      "Either of:",
      "- one,",
      "  still one",
      "- two",
      "1. three",
      "> quoted",
      "# Heading",
    );
    expect(unwrap(text)).toBe(
      lines(
        "Either of:",
        "- one, still one",
        "- two",
        "1. three",
        "> quoted",
        "# Heading",
      ),
    );
  });

  test("leaves code blocks alone", () => {
    const text = lines("Call it\nlike this:", "```swift", "a()", "b()", "```");
    expect(unwrap(text)).toBe(
      lines("Call it like this:", "```swift", "a()", "b()", "```"),
    );
  });
});

describe("mapProse", () => {
  test("changes every line outside code blocks, and none inside", () => {
    const text = lines("a", "```", "a", "```", "a", "~~~py", "a", "~~~");
    expect(mapProse(text, (line) => line.toUpperCase())).toBe(
      lines("A", "```", "a", "```", "A", "~~~py", "a", "~~~"),
    );
  });

  test("a longer fence closes a block, a shorter one does not", () => {
    const text = lines("````", "```", "a", "````", "a");
    expect(mapProse(text, () => "x")).toBe(
      lines("````", "```", "a", "````", "x"),
    );
  });

  test("an unclosed block runs to the end of the text", () => {
    expect(mapProse("a\n```\na", () => "x")).toBe("x\n```\na");
  });
});

describe("extractCodeBlocks", () => {
  test("takes out the blocks in the given languages, in order", () => {
    const text = lines(
      "Intro.",
      "",
      "```swift",
      "first()",
      "```",
      "",
      "Between.",
      "",
      "```Swift",
      "second()",
      "```",
    );
    expect(extractCodeBlocks(text, ["swift"])).toEqual({
      text: "Intro.\n\nBetween.",
      codeBlocks: [
        { lang: "swift", code: "first()" },
        { lang: "swift", code: "second()" },
      ],
    });
  });

  test("keeps blocks in other languages and blocks without one", () => {
    const text = lines("```json", "{}", "```", "", "```", "plain", "```");
    expect(extractCodeBlocks(text, ["swift"])).toEqual({
      text,
      codeBlocks: [],
    });
  });

  test("removes the indent of an indented block from its code", () => {
    const text = lines("  ```python", "  if x:", "      y()", "  ```");
    expect(extractCodeBlocks(text, ["python"]).codeBlocks).toEqual([
      { lang: "python", code: "if x:\n    y()" },
    ]);
  });

  test("keeps blank lines inside a block", () => {
    const text = lines("```py", "a()", "", "b()", "```");
    expect(extractCodeBlocks(text, ["py"]).codeBlocks[0]?.code).toBe(
      "a()\n\nb()",
    );
  });
});

describe("extractTitledCodeBlocks", () => {
  test("titles each block with the paragraph right above it, on one line and without a colon", () => {
    const text = lines(
      "Sign up with an",
      "email:",
      "",
      "```python",
      "sign_up()",
      "```",
    );
    expect(extractTitledCodeBlocks(text, ["python"])).toEqual({
      text: "",
      codeBlocks: [
        { title: "Sign up with an email", lang: "python", code: "sign_up()" },
      ],
    });
  });

  test("gives no title to a block right below another block", () => {
    const text = lines(
      "First:",
      "",
      "```python",
      "a()",
      "```",
      "",
      "```python",
      "b()",
      "```",
      "",
      "```json",
      "{}",
      "```",
      "```python",
      "c()",
      "```",
    );
    expect(extractTitledCodeBlocks(text, ["python"])).toEqual({
      text: "```json\n{}\n```",
      codeBlocks: [
        { title: "First", lang: "python", code: "a()" },
        { lang: "python", code: "b()" },
        { lang: "python", code: "c()" },
      ],
    });
  });

  test("takes only the last paragraph, and keeps the prose that titles nothing", () => {
    const text = lines(
      "Intro.",
      "",
      "Count:",
      "",
      "```python",
      "count()",
      "```",
      "",
      "Outro.",
    );
    expect(extractTitledCodeBlocks(text, ["python"])).toEqual({
      text: "Intro.\n\nOutro.",
      codeBlocks: [{ title: "Count", lang: "python", code: "count()" }],
    });
  });
});

describe("fenceDoctests", () => {
  test("puts a doctest in a code block, up to the next blank line", () => {
    expect(
      fenceDoctests(
        lines("Use it:", "", ">>> add(1, 2)", "3", "", "Done."),
        "python",
      ),
    ).toBe(
      lines(
        "Use it:",
        "",
        "```python",
        ">>> add(1, 2)",
        "3",
        "```",
        "",
        "Done.",
      ),
    );
  });

  test("closes the block at the end of the text", () => {
    expect(fenceDoctests(">>> a()\n>>> b()", "python")).toBe(
      lines("```python", ">>> a()", ">>> b()", "```"),
    );
  });

  test("removes the indent of an indented doctest", () => {
    expect(fenceDoctests("    >>> a()\n    1", "python")).toBe(
      lines("```python", ">>> a()", "1", "```"),
    );
  });

  test("leaves a doctest that is already in a code block alone", () => {
    const text = lines("```pycon", ">>> a()", "1", "```");
    expect(fenceDoctests(text, "python")).toBe(text);
  });

  test("leaves text without a doctest alone", () => {
    const text = lines("> A quote.", "", "Text.");
    expect(fenceDoctests(text, "python")).toBe(text);
  });
});
