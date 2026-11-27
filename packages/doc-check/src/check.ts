import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import matter from "gray-matter";
import { readBundledSchema, SchemaError } from "./schema.ts";

/** One thing wrong with one file. `path` is a JSON pointer into the frontmatter. */
export interface Problem {
  readonly file: string;
  readonly path: string;
  readonly message: string;
}

export interface CheckResult {
  /** Number of definition files looked at. */
  readonly files: number;
  readonly problems: readonly Problem[];
}

export interface DefinitionFile {
  readonly name: string;
  readonly text: string;
}

/**
 * The docs site turns the remote file name into a local one, so it only
 * accepts lowercase words separated by hyphens.
 */
const DEFINITION_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

type Frontmatter =
  | { readonly ok: true; readonly data: unknown }
  | { readonly ok: false; readonly message: string };

/**
 * Reads the frontmatter the way the docs site does, with gray-matter. That is
 * a different YAML parser than the one the generator writes with, on purpose:
 * a value both parsers read the same way is a value the docs site reads the
 * way the generator meant it.
 */
export function parseFrontmatter(text: string): Frontmatter {
  if (!matter.test(text)) {
    return { ok: false, message: "missing YAML frontmatter" };
  }
  try {
    // An options object keeps gray-matter from caching by content, so the
    // same text is always parsed again.
    return { ok: true, data: matter(text, {}).data };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `invalid YAML frontmatter: ${reason}` };
  }
}

/** A compiled schema: everything wrong with one frontmatter value. */
export type SchemaValidator = (
  data: unknown,
) => readonly { readonly path: string; readonly message: string }[];

/**
 * Compiles the text of a schema file. Throws a `SchemaError` when the text is
 * not JSON, or not a JSON Schema this check understands in full. A keyword it
 * does not know is an error and not a warning: skipping it would pass
 * definitions that the docs site rejects.
 */
export function compileSchema(text: string): SchemaValidator {
  let schema: unknown;
  try {
    schema = JSON.parse(text);
  } catch {
    throw new SchemaError("The schema is not JSON.");
  }
  let validate: ValidateFunction;
  try {
    validate = new Ajv2020({ allErrors: true }).compile(schema as object);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new SchemaError(`The schema cannot be used: ${reason}`);
  }
  return (data) =>
    validate(data)
      ? []
      : (validate.errors ?? []).map((error) => {
          const extra =
            typeof error.params.additionalProperty === "string"
              ? `: ${error.params.additionalProperty}`
              : "";
          return {
            path: error.instancePath || "/",
            message: `${error.message ?? "is invalid"}${extra}`,
          };
        });
}

let cachedBundled: SchemaValidator | undefined;

/** The schema bundled with this package, compiled once. */
export const bundledValidator = (): SchemaValidator =>
  (cachedBundled ??= compileSchema(readBundledSchema()));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Example ids are "stable within the definition", so a repeated one is a bug. */
const duplicateExampleIds = (data: Record<string, unknown>): string[] => {
  const examples = Array.isArray(data.examples) ? data.examples : [];
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const example of examples) {
    const id = isRecord(example) ? example.id : undefined;
    if (typeof id !== "string") {
      continue;
    }
    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
  }
  return [...duplicates];
};

/**
 * Every problem in one definition file. Pure: no file system, no network.
 * `validate` is the schema to check against; the bundled one by default.
 */
export function checkDefinitionFile(
  file: DefinitionFile,
  validate: SchemaValidator = bundledValidator(),
): Problem[] {
  const problems: Problem[] = [];
  const report = (path: string, message: string): void => {
    problems.push({ file: file.name, path, message });
  };

  if (!DEFINITION_FILE.test(file.name)) {
    report("/", "file name must be lowercase words separated by hyphens");
  }
  const frontmatter = parseFrontmatter(file.text);
  if (!frontmatter.ok) {
    report("/", frontmatter.message);
    return problems;
  }

  const { data } = frontmatter;
  for (const { path, message } of validate(data)) {
    report(path, message);
  }
  if (!isRecord(data)) {
    return problems;
  }
  // JSON Schema cannot compare a value with the file name.
  if (`${String(data.id)}.md` !== file.name) {
    report("/id", `id "${String(data.id)}" does not match the file name`);
  }
  for (const id of duplicateExampleIds(data)) {
    report("/examples", `example id "${id}" is used more than once`);
  }
  return problems;
}

/**
 * Checks a set of definition files and reports every problem in every file.
 * An empty set is a problem too, so a generator that silently wrote nothing
 * cannot pass.
 */
export function checkDefinitions(
  files: readonly DefinitionFile[],
  validate: SchemaValidator = bundledValidator(),
): CheckResult {
  if (files.length === 0) {
    return {
      files: 0,
      problems: [{ file: "", path: "/", message: "no definitions found" }],
    };
  }
  return {
    files: files.length,
    problems: files.flatMap((file) => checkDefinitionFile(file, validate)),
  };
}

/** Checks every `*.md` file directly inside `directory`, in name order. */
export function checkDirectory(
  directory: string,
  validate: SchemaValidator = bundledValidator(),
): CheckResult {
  const names = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();
  return checkDefinitions(
    names.map((name) => ({
      name,
      text: readFileSync(join(directory, name), "utf8"),
    })),
    validate,
  );
}
