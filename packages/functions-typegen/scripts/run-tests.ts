/**
 * Test runner that resolves test paths from this script's location, so
 * `bun run test` works whether invoked from the package directory or from the
 * monorepo root.
 */
import { join } from "node:path";

const pkgRoot = join(import.meta.dir, "..");
const args = process.argv.slice(2);

const proc = Bun.spawn({
  cmd: [
    "bun",
    "test",
    "--timeout",
    "30000",
    "--concurrent",
    "--max-concurrency",
    "8",
    ...args,
  ],
  cwd: pkgRoot,
  stdio: ["inherit", "inherit", "inherit"],
});

const exitCode = await proc.exited;
process.exit(exitCode);
