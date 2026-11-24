import {
  extractCodeBlocks,
  firstParagraph,
  mapProse,
  unwrap,
} from "../../markdown.ts";
import type { ApiDoc, ApiThrow } from "../../model.ts";

/** A doc comment split into the fields the docs schema has. */
export interface SwiftDoc extends ApiDoc {
  /** Parameter descriptions by the name the comment uses. */
  readonly parameters: ReadonlyMap<string, string>;
}

type Callout = { readonly indent: number; readonly rest: string } & (
  | { readonly tag: "parameters" | "returns" | "throws" }
  | { readonly tag: "parameter"; readonly name: string }
);

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const LIST_ITEM = /^( {0,3})- (.*)$/;
const NAME = "`?([A-Za-z_$][\\w$]*)`?";
const PARAMETER = new RegExp(`^Parameter\\s+${NAME}\\s*:\\s*(.*)$`, "i");
const TAG = /^(Parameters|Returns|Throws)\s*:\s*(.*)$/i;
const NESTED_PARAMETER = new RegExp(`^- ${NAME}\\s*:\\s*(.*)$`);
/** A line that cannot continue the paragraph of the list item above it. */
const STARTS_BLOCK = /^\s*(?:[-*+]\s|\d+[.)]\s|>|#|`{3,}|~{3,})/;
const SYMBOL_LINK = /``([^`\n]+)``/;

const indentOf = (line: string): number =>
  line.length - line.trimStart().length;

const stripIndent = (line: string, indent: number): string =>
  line.slice(Math.min(indent, indentOf(line)));

/** The fence that is open after `line`, given the one open before it. */
function fenceAfter(
  open: string | undefined,
  line: string,
): string | undefined {
  if (open === undefined) {
    return FENCE.exec(line)?.[1];
  }
  const trimmed = line.trim();
  const closes =
    trimmed.length >= open.length &&
    trimmed === open.charAt(0).repeat(trimmed.length);
  return closes ? undefined : open;
}

function parseCallout(line: string): Callout | undefined {
  const item = LIST_ITEM.exec(line);
  if (!item) {
    return undefined;
  }
  const [, indent = "", head = ""] = item;
  const single = PARAMETER.exec(head);
  if (single) {
    return {
      tag: "parameter",
      name: single[1] ?? "",
      indent: indent.length,
      rest: single[2] ?? "",
    };
  }
  const tagged = TAG.exec(head);
  if (!tagged) {
    return undefined;
  }
  return {
    tag: (tagged[1] ?? "").toLowerCase() as "parameters" | "returns" | "throws",
    indent: indent.length,
    rest: tagged[2] ?? "",
  };
}

/**
 * `## Topics` curates the DocC sidebar and means nothing on an API docs
 * page. The section runs to the next heading of the same or a higher level.
 */
function dropTopics(lines: readonly string[]): string[] {
  const kept: string[] = [];
  let inTopics = false;
  for (const line of lines) {
    if (/^##\s+Topics\s*$/.test(line)) {
      inTopics = true;
    } else if (inTopics && /^#{1,2}\s/.test(line)) {
      inTopics = false;
    }
    if (!inTopics) {
      kept.push(line);
    }
  }
  return kept;
}

/**
 * Index after the last line of the list item that starts at `start`. A line
 * belongs to the item when it is indented past the marker, or when it carries
 * on the paragraph directly above it. Blank lines belong to it only when such
 * a line follows.
 */
function itemEnd(
  lines: readonly string[],
  start: number,
  indent: number,
): number {
  let last = start;
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      continue;
    }
    const afterBlank = (lines[index - 1] ?? "").trim() === "";
    const indented = indentOf(line) >= indent + 2;
    if (!indented && (afterBlank || STARTS_BLOCK.test(line))) {
      break;
    }
    last = index;
  }
  return last + 1;
}

/**
 * The name a symbol link shows. `AuthClient/mfa-swift.property/enroll(_:)`
 * becomes `AuthClient.mfa.enroll(_:)`: the suffix after a hyphen only tells
 * DocC which of several symbols with one name is meant.
 */
export const linkTarget = (link: string): string =>
  link
    .split("/")
    .map((component) => component.replace(/(?<=[\w)])-.*$/, ""))
    .join(".");

/** Turns DocC links into plain names, since a definition has to stand alone. */
const rewriteLinks = (line: string): string =>
  line
    .replace(
      new RegExp(SYMBOL_LINK, "g"),
      (_, link: string) => `\`${linkTarget(link)}\``,
    )
    .replace(/<doc:([^>#]+)(?:#[^>]*)?>/g, "$1");

/** A callout's text on as few lines as Markdown allows, links rewritten. */
const calloutText = (lines: readonly string[]): string =>
  mapProse(unwrap(lines.join("\n")), rewriteLinks);

function nestedParameters(lines: readonly string[]): [string, string][] {
  const parameters: [string, string][] = [];
  let index = 0;
  while (index < lines.length) {
    const match = NESTED_PARAMETER.exec(lines[index] ?? "");
    if (match?.[1] === undefined) {
      index++;
      continue;
    }
    const end = itemEnd(lines, index, 0);
    const rest = lines
      .slice(index + 1, end)
      .map((line) => stripIndent(line, 2));
    parameters.push([match[1], calloutText([match[2] ?? "", ...rest])]);
    index = end;
  }
  return parameters;
}

/**
 * Parses the lines of a `///` doc comment as the symbol graph stores them:
 * raw text, one entry per line, with nothing interpreted. `- Parameters:`,
 * `- Parameter x:`, `- Returns:` and `- Throws:` become fields, `swift` code
 * blocks become examples, and the rest is the description. Other callouts
 * (`- Note:`, `- Warning:`) stay in the description: they are valid Markdown.
 */
export function parseDocComment(lines: readonly string[]): SwiftDoc {
  const prose: string[] = [];
  const parameters = new Map<string, string>();
  const returns: string[] = [];
  const throws: ApiThrow[] = [];

  const body = dropTopics(lines);
  let fence: string | undefined;
  let index = 0;
  while (index < body.length) {
    const line = body[index] ?? "";
    const callout = fence === undefined ? parseCallout(line) : undefined;
    if (callout === undefined) {
      fence = fenceAfter(fence, line);
      prose.push(line);
      index++;
      continue;
    }

    const end = itemEnd(body, index, callout.indent);
    const continued = body
      .slice(index + 1, end)
      .map((next) => stripIndent(next, callout.indent + 2));
    const text = [callout.rest, ...continued];
    if (callout.tag === "parameter") {
      parameters.set(callout.name, calloutText(text));
    } else if (callout.tag === "parameters") {
      for (const [name, description] of nestedParameters(continued)) {
        parameters.set(name, description);
      }
    } else if (callout.tag === "returns") {
      returns.push(calloutText(text));
    } else {
      // The error type is the first symbol the callout links to.
      const link = SYMBOL_LINK.exec(text.join("\n"))?.[1];
      throws.push({
        ...(link === undefined ? {} : { type: linkTarget(link) }),
        description: calloutText(text),
      });
    }
    index = end;
  }

  const { text, codeBlocks } = extractCodeBlocks(prose.join("\n"), ["swift"]);
  const description = mapProse(text, rewriteLinks);
  return {
    summary: firstParagraph(description),
    description,
    parameters,
    ...(returns.length === 0 ? {} : { returns: returns.join("\n\n") }),
    throws,
    examples: codeBlocks,
  };
}
