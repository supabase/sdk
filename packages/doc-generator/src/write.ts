import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { GeneratedFile } from "./generate.ts";
import { DEFINITION_ID } from "./slug.ts";

/**
 * Whether a file is a definition an earlier run wrote: named `<id>.md` and
 * opening with frontmatter whose first key is that id. Anything else in the
 * folder is not ours to delete.
 */
function isDefinitionFile(directory: string, name: string): boolean {
  const id = name.endsWith(".md") ? name.slice(0, -".md".length) : "";
  if (!DEFINITION_ID.test(id)) {
    return false;
  }
  const head = readFileSync(join(directory, name), "utf8").slice(0, 512);
  return new RegExp(`^---\\r?\\nid: ["']?${id}["']?\\r?\\n`).test(head);
}

/**
 * Replaces the definitions in `directory` with `files`. The old definitions
 * are removed first, so a function that is gone leaves no stale page behind.
 * Only files that are recognizably definitions are removed, and never a
 * folder, so a wrong `output` path cannot wipe unrelated files.
 */
export function writeDefinitions(
  directory: string,
  files: readonly GeneratedFile[],
): void {
  mkdirSync(directory, { recursive: true });
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isFile() && isDefinitionFile(directory, entry.name)) {
      rmSync(join(directory, entry.name));
    }
  }
  for (const file of files) {
    writeFileSync(join(directory, file.name), file.content);
  }
}
