import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { getApiCoverageMode, type RawCompliance } from "./compliance.js";

const [compliancePath] = process.argv.slice(2);

if (!compliancePath) {
  console.error("Usage: coverage-mode <sdk-compliance.yaml>");
  process.exit(1);
}

try {
  const compliance = parse(
    readFileSync(resolve(compliancePath), "utf8"),
  ) as RawCompliance;
  process.stdout.write(getApiCoverageMode(compliance));
} catch (error) {
  console.error(`Failed to read API coverage mode: ${(error as Error).message}`);
  process.exit(1);
}
