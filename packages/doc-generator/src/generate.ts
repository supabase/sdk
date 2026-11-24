import { buildDefinition, indexModel } from "./definition.ts";
import { GeneratorError } from "./errors.ts";
import { renderDefinitionFile } from "./frontmatter.ts";
import type { ApiModel } from "./model.ts";
import { DEFINITION_ID, slugify } from "./slug.ts";

export interface GenerateInput {
  readonly model: ApiModel;
  /**
   * Regular expressions matched against the names of the functions. A
   * function whose name matches one of them gets no definition.
   */
  readonly exclude?: readonly string[];
  /**
   * Whether a function without a doc comment is an error. By default it
   * gets a definition all the same, and is reported in the result.
   */
  readonly strict?: boolean;
}

export interface GeneratedFile {
  /** `<id>.md` */
  readonly name: string;
  readonly content: string;
}

export interface GenerateResult {
  /** One file per function, sorted by name. */
  readonly files: readonly GeneratedFile[];
  /**
   * The names of the functions that have no doc comment, sorted. Each has a
   * file in `files`, with an empty summary. Always empty in strict mode,
   * where one such function is an error.
   */
  readonly undocumented: readonly string[];
  /** The names of the functions that `exclude` left out, sorted. */
  readonly excluded: readonly string[];
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Turns an API model into definition files.
 *
 * Pure: the same input gives the same files, byte for byte, whatever order
 * the model's symbols arrive in. Nothing is read or written here.
 *
 * One definition is written per function of the model that `exclude` does
 * not name, with a doc comment or without one. Its id is made from its name
 * alone. The overloads of a function share its definition: the first one in
 * source order that has a doc comment is the one the definition documents,
 * or the first one of all when none has.
 *
 * Throws a `GeneratorError` that lists every id that two functions share
 * and every `exclude` pattern that matches nothing. In strict mode it also
 * lists every function without a doc comment that `exclude` does not name.
 */
export function generate(input: GenerateInput): GenerateResult {
  const index = indexModel(input.model);
  const exclude = (input.exclude ?? []).map((pattern) => ({
    pattern,
    matches: new RegExp(pattern),
    used: false,
  }));

  const problems: string[] = [];
  const files = new Map<string, GeneratedFile & { function: string }>();
  const undocumented: string[] = [];
  const excluded: string[] = [];

  for (const [name, overloads] of index.byName) {
    // Every pattern is tried, so one that only repeats another still counts
    // as used.
    const excluding = exclude.filter(({ matches }) => matches.test(name));
    if (excluding.length > 0) {
      for (const pattern of excluding) {
        pattern.used = true;
      }
      excluded.push(name);
      continue;
    }
    // A name has at least one overload, so `lead` is always found.
    const lead =
      overloads.find((overload) => overload.doc.summary !== "") ?? overloads[0];
    if (lead === undefined) {
      continue;
    }
    if (lead.doc.summary === "") {
      undocumented.push(name);
    }

    const id = slugify(name);
    if (!DEFINITION_ID.test(id)) {
      problems.push(`${name}: "${id}" is not a valid definition id`);
      continue;
    }
    const taken = files.get(id);
    if (taken !== undefined) {
      const [first, second] = [name, taken.function].sort(byText);
      problems.push(`${first} and ${second} both give the id "${id}"`);
      continue;
    }
    const { definition, notes } = buildDefinition(
      lead,
      overloads.filter((overload) => overload !== lead),
      index,
    );
    files.set(id, {
      function: name,
      name: `${id}.md`,
      content: renderDefinitionFile(definition, notes),
    });
  }

  // A pattern that matches nothing is a typo, or names a function that is
  // gone. Left alone, it would start to hide the next function it fits.
  for (const { pattern, used } of exclude) {
    if (!used) {
      problems.push(`exclude: ${pattern} matches no function`);
    }
  }

  // In strict mode a missing doc comment is a problem like the others, so
  // one run lists them all and writes nothing.
  const missing = input.strict ? undocumented : [];
  for (const name of missing) {
    problems.push(`${name} has no doc comment`);
  }

  if (problems.length > 0) {
    throw new GeneratorError(
      missing.length > 0
        ? "Cannot generate the definitions. `strict` is on: give every function a doc comment, or leave it out with `exclude`:"
        : "Cannot generate the definitions:",
      problems.sort(byText),
    );
  }
  return {
    files: [...files.values()]
      .map(({ name, content }) => ({ name, content }))
      .sort((a, b) => byText(a.name, b.name)),
    undocumented: undocumented.sort(byText),
    excluded: excluded.sort(byText),
  };
}
