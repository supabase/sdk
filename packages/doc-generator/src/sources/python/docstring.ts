import {
  extractTitledCodeBlocks,
  fenceDoctests,
  firstParagraph,
  tidy,
  unwrap,
} from "../../markdown.ts";
import type { ApiDoc, ApiExample, ApiThrow } from "../../model.ts";
import { type Expr, renderExpr } from "./expr.ts";

/** A docstring split into the fields the docs schema has. */
export interface PythonDoc extends ApiDoc {
  /** Parameter descriptions by parameter name, without `*` or `**`. */
  readonly parameters: ReadonlyMap<string, string>;
}

/**
 * One section of a docstring, as griffe parsed it. What `value` holds depends
 * on `kind`: text for `text`, a list of entries for `parameters`, one entry
 * for `admonition`, a list of `[kind, text]` pairs for `examples`.
 */
export interface DocstringSection {
  readonly kind: string;
  readonly title?: string | null;
  readonly value: unknown;
}

/** A docstring in a `griffe dump`. `parsed` is there with `--docstyle`. */
export interface Docstring {
  readonly value: string;
  readonly parsed?: readonly DocstringSection[];
}

interface Entry {
  readonly name?: string;
  readonly annotation?: Expr | null;
  readonly description?: string;
}

/** Code blocks in these languages are examples; `pycon` is a console session. */
const EXAMPLE_LANGUAGES = ["python", "py", "pycon"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const entriesOf = (value: unknown): Entry[] =>
  Array.isArray(value) ? (value.filter(isRecord) as Entry[]) : [];

/**
 * A section such as `Note:` or `Warning:` as a Markdown quote, so that it
 * stays where it was in the description: `> **Note:** text`.
 */
function quoteAdmonition(title: string, description: string): string {
  const [first = "", ...rest] = tidy(description).split("\n");
  return [
    `> **${title}:** ${first}`,
    ...rest.map((line) => `> ${line}`.trimEnd()),
  ].join("\n");
}

/**
 * Maps the sections griffe found in a docstring to the fields of a
 * definition. It reads what griffe parsed and never the raw text. The
 * docstrings are in Google style, which the SDK repositories enforce, and the
 * dump is made with `--docstyle google`.
 *
 * - text, and sections such as `Note:`, become the description
 * - `Args` and `Other Parameters` describe the parameters
 * - `Returns` and `Yields` describe what comes back
 * - `Raises` lists what is thrown
 * - the code blocks and doctests of an `Examples` section become examples,
 *   each titled by the paragraph right above it. Code anywhere else is part
 *   of the description.
 *
 * Sections about something else (`Attributes`, `Warns`) are left out.
 */
export function parseDocstring(docstring: Docstring | undefined): PythonDoc {
  // Without `--docstyle`, the dump has the text but no sections.
  const sections: readonly DocstringSection[] =
    docstring?.parsed ??
    (docstring === undefined ? [] : [{ kind: "text", value: docstring.value }]);

  const prose: string[] = [];
  const parameters = new Map<string, string>();
  const returns: string[] = [];
  const throws: ApiThrow[] = [];
  const examples: ApiExample[] = [];
  // The parts of an `Examples` section: its code becomes examples, and the
  // text that titles no example stays in the description, where it was.
  const readExamples = (parts: readonly string[]): void => {
    const { text, codeBlocks } = extractTitledCodeBlocks(
      fenceDoctests(parts.join("\n\n"), "python"),
      EXAMPLE_LANGUAGES,
    );
    prose.push(text);
    examples.push(...codeBlocks);
  };
  for (const { kind, title, value } of sections) {
    if (kind === "text" && typeof value === "string") {
      prose.push(value);
    } else if (kind === "parameters" || kind === "other parameters") {
      for (const entry of entriesOf(value)) {
        if (entry.name === undefined) {
          continue;
        }
        // Google style documents `*args` under that name; the signature
        // names the parameter `args`.
        parameters.set(
          entry.name.replace(/^\*+/, ""),
          unwrap(entry.description ?? ""),
        );
      }
    } else if (kind === "returns" || kind === "yields") {
      for (const { description = "" } of entriesOf(value)) {
        if (description.trim() !== "") {
          returns.push(unwrap(description));
        }
      }
    } else if (kind === "raises") {
      for (const entry of entriesOf(value)) {
        const type =
          entry.annotation === null || entry.annotation === undefined
            ? ""
            : renderExpr(entry.annotation).replaceAll("`", "");
        throws.push({
          ...(type === "" ? {} : { type }),
          description: unwrap(entry.description ?? ""),
        });
      }
    } else if (kind === "admonition" && isRecord(value)) {
      const text = (field: unknown): string =>
        typeof field === "string" ? field : "";
      prose.push(
        quoteAdmonition(
          title ?? text(value.annotation),
          text(value.description),
        ),
      );
    } else if (kind === "examples" && Array.isArray(value)) {
      // Pairs of a kind and a text: prose, or a doctest under `examples`.
      readExamples(
        value.flatMap((item) =>
          Array.isArray(item) && typeof item[1] === "string" ? [item[1]] : [],
        ),
      );
    }
  }

  // A doctest outside `Examples` is fenced too, so that Markdown shows it as
  // code and not as nested quotes.
  const description = tidy(fenceDoctests(prose.join("\n\n"), "python"));
  return {
    summary: firstParagraph(description),
    description,
    parameters,
    ...(returns.length === 0 ? {} : { returns: returns.join("\n\n") }),
    throws,
    examples,
  };
}
