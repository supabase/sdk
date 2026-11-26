/**
 * Runs in a child process spawned by typescript.test.ts, because every test
 * file shares one process and the snapshot tests load oxfmt through the
 * default formatter, which would mask whether this call loaded it.
 */
import { generateTypescript } from "../../src/generation/typescript.ts";
import { buildMetadata } from "./fixtures.ts";

const loadedOxfmtModules = () =>
  Object.keys(require.cache).filter((path) => path.includes("/oxfmt/"));

const metadata = buildMetadata({});
await generateTypescript(metadata, { format: async (code) => code });
const afterCallerFormat = loadedOxfmtModules();

let defaultFormatError: string | null = null;
try {
  await generateTypescript(metadata);
} catch (error) {
  defaultFormatError = (error as Error).message;
}
const afterDefaultFormat = loadedOxfmtModules();

console.log(
  JSON.stringify({ afterCallerFormat, afterDefaultFormat, defaultFormatError }),
);
