/**
 * Regenerate `test/fixtures/expected/project.json` from the
 * fixture project. Review the diff before committing: every change here is a
 * change every consumer of the `edgeFunctions` collection sees.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { extractEdgeFunctions } from "../src/extract.ts";

const pkgRoot = join(import.meta.dir, "..");
const functions = await extractEdgeFunctions({
  projectRoot: join(pkgRoot, "test", "fixtures", "project"),
});
const expectedDirectory = join(pkgRoot, "test", "fixtures", "expected");
await mkdir(expectedDirectory, { recursive: true });
await writeFile(
  join(expectedDirectory, "project.json"),
  `${JSON.stringify(functions, null, 2)}\n`,
);
