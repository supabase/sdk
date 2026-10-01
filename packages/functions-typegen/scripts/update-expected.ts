/**
 * Regenerate `test/fixtures/expected/project.json` from the fixture project
 * with the `deno` binary on this machine. Review the diff before committing:
 * every change here is a change every consumer of the document sees.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createLocalDenoRunner } from "../src/deno.ts";
import { extractEdgeFunctionsMetadata } from "../src/extract.ts";

const pkgRoot = join(import.meta.dir, "..");
const document = await extractEdgeFunctionsMetadata({
  projectRoot: join(pkgRoot, "test", "fixtures", "project"),
  deno: createLocalDenoRunner(),
});
// The broken function's message carries Deno's wording and an absolute path;
// the test checks it loosely, so keep the fixture free of it.
document.diagnostics = document.diagnostics.filter((d) => d.slug !== "broken");
await writeFile(
  join(pkgRoot, "test", "fixtures", "expected", "project.json"),
  `${JSON.stringify(document, null, 2)}\n`,
);
