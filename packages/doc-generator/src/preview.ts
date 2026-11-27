import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { PreviewConfig } from "./config.ts";
import { GeneratorError } from "./errors.ts";
import { writeDefinitions } from "./write.ts";

/**
 * Where a checkout of supabase/supabase keeps the pages the docs site builds
 * from definitions. A folder below it with an `index.md` is a library, and
 * its `definitions/` folder holds one file per page. The docs build fills
 * that folder from the library's repository; a preview fills it from disk.
 *
 * This layout is the docs team's and is the only place it is written down
 * here, so a change on their side is a change in this file.
 */
const DOCS_CONTENT = join("apps", "docs", "content", "reference-beta");
const DOCS_URL = "http://localhost:3001/docs/reference-beta";

export interface PreviewInput {
  /** The folder the generator wrote the definitions to. */
  readonly definitions: string;
  /** A local checkout of supabase/supabase. */
  readonly docs: string;
  readonly preview: PreviewConfig;
  /** Code fence language of the SDK's signatures. */
  readonly language: string;
}

export interface PreviewResult {
  /** The folder in the docs checkout that now holds the definitions. */
  readonly directory: string;
  readonly definitions: number;
  /** The placeholder introduction page, when this run wrote it. */
  readonly index?: string;
  /** Where the running docs site shows the SDK. */
  readonly url: string;
}

/**
 * The introduction page of a library, as little of it as the docs site needs
 * to show the definitions. The docs team writes the real one.
 */
export const placeholderIndex = (title: string, language: string): string =>
  [
    "---",
    // A JSON string is a YAML double-quoted string.
    `title: ${JSON.stringify(title)}`,
    `code_lang: ${JSON.stringify(language)}`,
    "---",
    "",
    "A placeholder written by `doc-generator preview`, so that the definitions",
    "show up on a local docs site. The docs team writes the real introduction.",
    "",
  ].join("\n");

const isDirectory = (path: string): boolean =>
  existsSync(path) && statSync(path).isDirectory();

/**
 * Puts the generated definitions into a local checkout of the docs site, so
 * that the site there shows them as it will on supabase.com.
 *
 * The definitions of an earlier preview are replaced. The introduction page
 * is only written when the checkout has none, so one that the docs team
 * wrote, or that was edited after an earlier preview, is left alone.
 */
export function previewDefinitions(input: PreviewInput): PreviewResult {
  const content = join(input.docs, DOCS_CONTENT);
  if (!isDirectory(content)) {
    throw new GeneratorError(
      `${input.docs} has no ${DOCS_CONTENT}. Give a checkout of supabase/supabase on a branch that has the new reference pages.`,
    );
  }
  if (!isDirectory(input.definitions)) {
    throw new GeneratorError(
      `There are no definitions in ${input.definitions}. Generate them first.`,
    );
  }
  const files = readdirSync(input.definitions)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => ({
      name,
      content: readFileSync(join(input.definitions, name), "utf8"),
    }));
  if (files.length === 0) {
    throw new GeneratorError(
      `There are no definitions in ${input.definitions}. Generate them first.`,
    );
  }

  const library = join(content, ...input.preview.path.split("/"));
  const directory = join(library, "definitions");
  writeDefinitions(directory, files);

  const index = join(library, "index.md");
  const writesIndex = !existsSync(index);
  if (writesIndex) {
    mkdirSync(library, { recursive: true });
    writeFileSync(index, placeholderIndex(input.preview.title, input.language));
  }
  return {
    directory,
    definitions: files.length,
    ...(writesIndex ? { index } : {}),
    url: `${DOCS_URL}/${input.preview.path}`,
  };
}
