/**
 * The few Markdown operations doc comments need. None of them parses Markdown
 * in full: they split a text into prose and fenced code blocks, and only ever
 * change the prose.
 */

interface Prose {
  readonly kind: "prose";
  readonly lines: readonly string[];
}

interface Fence {
  readonly kind: "fence";
  /** The opening and closing fence lines and everything between them. */
  readonly lines: readonly string[];
  /** First word of the info string, lowercased: `swift` in "```swift". */
  readonly lang: string;
  /** The content without the fence lines and without the fence's indent. */
  readonly code: string;
}

type Block = Prose | Fence;

const FENCE_OPEN = /^( {0,3})(`{3,}|~{3,})\s*([^\s`]*)[^`]*$/;

const closes = (line: string, marker: string): boolean => {
  const trimmed = line.trim();
  return (
    trimmed.length >= marker.length &&
    trimmed === marker[0]?.repeat(trimmed.length)
  );
};

const stripIndent = (line: string, indent: number): string => {
  let index = 0;
  while (index < indent && line[index] === " ") {
    index++;
  }
  return line.slice(index);
};

/** Splits a text into prose and fenced code blocks, in order. */
function blocks(markdown: string): Block[] {
  const result: Block[] = [];
  let prose: string[] = [];
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const open = FENCE_OPEN.exec(line);
    if (!open) {
      prose.push(line);
      continue;
    }
    const [, indent = "", marker = "", lang = ""] = open;
    let end = index + 1;
    while (end < lines.length && !closes(lines[end] ?? "", marker)) {
      end++;
    }
    if (prose.length > 0) {
      result.push({ kind: "prose", lines: prose });
      prose = [];
    }
    // An unclosed fence runs to the end of the text, as Markdown has it.
    result.push({
      kind: "fence",
      lines: lines.slice(index, end + 1),
      lang: lang.toLowerCase(),
      code: lines
        .slice(index + 1, end)
        .map((codeLine) => stripIndent(codeLine, indent.length))
        .join("\n"),
    });
    index = end;
  }
  if (prose.length > 0) {
    result.push({ kind: "prose", lines: prose });
  }
  return result;
}

/**
 * Trims trailing whitespace, leading and trailing blank lines, and runs of
 * blank lines, everywhere but inside code blocks.
 */
export function tidy(markdown: string): string {
  const result: string[] = [];
  for (const block of blocks(markdown)) {
    if (block.kind === "fence") {
      result.push(...block.lines);
      continue;
    }
    for (const raw of block.lines) {
      const line = raw.trimEnd();
      if (line === "" && (result.length === 0 || result.at(-1) === "")) {
        continue;
      }
      result.push(line);
    }
  }
  while (result.at(-1) === "") {
    result.pop();
  }
  return result.join("\n");
}

/** Applies `change` to every line that is not part of a code block. */
export function mapProse(
  markdown: string,
  change: (line: string) => string,
): string {
  return blocks(markdown)
    .flatMap((block) =>
      block.kind === "fence" ? block.lines : block.lines.map(change),
    )
    .join("\n");
}

/** The first paragraph on one line: what a list of definitions shows. */
export function firstParagraph(markdown: string): string {
  const lines: string[] = [];
  for (const block of blocks(tidy(markdown))) {
    if (block.kind === "fence") {
      break;
    }
    for (const line of block.lines) {
      if (line === "" && lines.length > 0) {
        return lines.join(" ");
      }
      if (line !== "") {
        lines.push(line.trim());
      }
    }
  }
  return lines.join(" ");
}

const STARTS_BLOCK = /^\s*(?:[-*+]\s|\d+[.)]\s|>|#|\|)/;

/**
 * Joins the hard-wrapped lines of each paragraph into one line. A line that
 * starts a list item, a quote, a heading or a table row stays on its own
 * line, and code blocks are left alone.
 */
export function unwrap(markdown: string): string {
  const result: string[] = [];
  for (const block of blocks(tidy(markdown))) {
    if (block.kind === "fence") {
      result.push(...block.lines);
      continue;
    }
    let paragraph: string | undefined;
    const flush = (): void => {
      if (paragraph !== undefined) {
        result.push(paragraph);
        paragraph = undefined;
      }
    };
    for (const line of block.lines) {
      if (line === "") {
        flush();
        result.push("");
      } else if (paragraph === undefined || STARTS_BLOCK.test(line)) {
        flush();
        paragraph = line.trimEnd();
      } else {
        paragraph += ` ${line.trim()}`;
      }
    }
    flush();
  }
  return result.join("\n");
}

export interface CodeBlock {
  readonly lang: string;
  readonly code: string;
}

/**
 * Takes the code blocks written in one of `languages` out of a text. Returns
 * the text without them and the blocks in order. Blocks in other languages
 * (a JSON response, a shell command) stay where they are.
 */
export function extractCodeBlocks(
  markdown: string,
  languages: readonly string[],
): { readonly text: string; readonly codeBlocks: readonly CodeBlock[] } {
  const kept: string[] = [];
  const codeBlocks: CodeBlock[] = [];
  for (const block of blocks(markdown)) {
    if (block.kind === "fence" && languages.includes(block.lang)) {
      codeBlocks.push({ lang: block.lang, code: block.code });
    } else {
      kept.push(...block.lines);
    }
  }
  return { text: tidy(kept.join("\n")), codeBlocks };
}

export interface TitledCodeBlock extends CodeBlock {
  /** The paragraph right above the block, on one line, without a colon. */
  readonly title?: string;
}

/**
 * Like `extractCodeBlocks`, and each block also takes the paragraph right
 * above it as its title: "Sign up with an email:" titles the block below it.
 * A block right below another block has no title. Prose that titles no block
 * stays in the text.
 */
export function extractTitledCodeBlocks(
  markdown: string,
  languages: readonly string[],
): { readonly text: string; readonly codeBlocks: readonly TitledCodeBlock[] } {
  const kept: Block[] = [];
  const codeBlocks: TitledCodeBlock[] = [];
  for (const block of blocks(markdown)) {
    if (block.kind !== "fence" || !languages.includes(block.lang)) {
      kept.push(block);
      continue;
    }
    // The last paragraph of the prose above, if nothing else is between.
    const above = kept.at(-1);
    const lines = above?.kind === "prose" ? [...above.lines] : [];
    while (lines.at(-1)?.trim() === "") {
      lines.pop();
    }
    const start = lines.findLastIndex((line) => line.trim() === "") + 1;
    const title = lines
      .slice(start)
      .map((line) => line.trim())
      .join(" ")
      .replace(/:$/, "");
    if (title !== "") {
      kept[kept.length - 1] = { kind: "prose", lines: lines.slice(0, start) };
    }
    codeBlocks.push({
      ...(title === "" ? {} : { title }),
      lang: block.lang,
      code: block.code,
    });
  }
  return {
    text: tidy(kept.flatMap((block) => block.lines).join("\n")),
    codeBlocks,
  };
}

/**
 * Puts a code fence around every doctest: a paragraph whose first line starts
 * with `>>>`. Markdown would read those lines as nested quotes. Doctests that
 * are already inside a code block are left alone.
 */
export function fenceDoctests(markdown: string, lang: string): string {
  const result: string[] = [];
  for (const block of blocks(markdown)) {
    if (block.kind === "fence") {
      result.push(...block.lines);
      continue;
    }
    let inDoctest = false;
    for (const line of block.lines) {
      const blank = line.trim() === "";
      if (!inDoctest && line.trimStart().startsWith(">>>")) {
        result.push(`\`\`\`${lang}`);
        inDoctest = true;
      } else if (inDoctest && blank) {
        result.push("```");
        inDoctest = false;
      }
      result.push(inDoctest ? line.trimStart() : line);
    }
    if (inDoctest) {
      result.push("```");
    }
  }
  return result.join("\n");
}
