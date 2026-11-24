import { Document, Scalar, visit } from "yaml";
import type { Definition, DefinitionField } from "./definition.ts";

/**
 * The docs schema's key order. A file is written in this order whatever
 * order the object was built in, so the bytes depend on the values alone.
 * Typed as records so that a key added to a type but not listed here fails to
 * compile, instead of silently never being written.
 */
const DEFINITION_KEYS = Object.keys({
  id: true,
  kind: true,
  category: true,
  title: true,
  symbol: true,
  summary: true,
  description: true,
  signature: true,
  type_params: true,
  stability: true,
  deprecated: true,
  parameters: true,
  returns: true,
  throws: true,
  examples: true,
} satisfies Record<keyof Definition, true>) as (keyof Definition)[];

const FIELD_KEYS = Object.keys({
  name: true,
  location: true,
  type: true,
  required: true,
  description: true,
  default: true,
  allowed_values: true,
  variadic: true,
  children: true,
} satisfies Record<keyof DefinitionField, true>) as (keyof DefinitionField)[];

/** The keys of `value` that are set, in the order of `keys`. */
function ordered<T extends object>(
  value: T,
  keys: readonly (keyof T)[],
): Partial<T> {
  const result: Partial<T> = {};
  for (const key of keys) {
    if (value[key] !== undefined) {
      result[key] = value[key];
    }
  }
  return result;
}

const orderedField = (field: DefinitionField): object => ({
  ...ordered(field, FIELD_KEYS),
  ...(field.children === undefined
    ? {}
    : { children: field.children.map(orderedField) }),
});

const orderedDefinition = (definition: Definition): object => ({
  ...ordered(definition, DEFINITION_KEYS),
  parameters: definition.parameters.map(orderedField),
  ...(definition.returns === undefined
    ? {}
    : { returns: ordered(definition.returns, ["type", "description"]) }),
  throws: definition.throws.map((thrown) =>
    ordered(thrown, ["type", "description"]),
  ),
  examples: definition.examples.map((example) =>
    ordered(example, ["id", "title", "lang", "code"]),
  ),
});

/**
 * Renders one definition file: YAML frontmatter, then optional Markdown.
 *
 * The YAML is written so that every parser reads it the same way. The docs
 * site reads it with a YAML 1.1 parser, which takes a bare `2026-01-01` for a
 * timestamp, `1e3` for a number and `~` for null, where a YAML 1.2 writer
 * sees plain strings. So no string is left bare: one-line strings are
 * double-quoted, and multi-line strings are literal blocks, which no parser
 * interprets. Lines are never folded, because a folded line reads as changed
 * text in a diff when only its length changed.
 */
export function renderDefinitionFile(
  definition: Definition,
  notes: string,
): string {
  const document = new Document(orderedDefinition(definition));
  visit(document, {
    Scalar(key, node) {
      if (key !== "key" && typeof node.value === "string") {
        node.type = fitsLiteralBlock(node.value)
          ? Scalar.BLOCK_LITERAL
          : Scalar.QUOTE_DOUBLE;
      }
    },
  });
  const frontmatter = document.toString({ lineWidth: 0 });
  return `---\n${frontmatter}---\n${notes === "" ? "" : `\n${notes}\n`}`;
}

/**
 * Whether a string is written as a literal block. A block keeps several
 * trailing line breaks only with a marker that the docs site's frontmatter
 * splitter undoes when the block is the last thing before the closing `---`,
 * so such a string is quoted, with its line breaks escaped.
 */
const fitsLiteralBlock = (value: string): boolean =>
  value.includes("\n") && !value.endsWith("\n\n");
