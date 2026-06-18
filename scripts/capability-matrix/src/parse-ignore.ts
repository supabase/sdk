import ignore, { type Ignore } from "ignore";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type { Ignore };

export function loadIgnore(projectRoot: string): Ignore {
  const ig = ignore();
  const filePath = join(projectRoot, "sdk-parse-ignore");
  if (existsSync(filePath)) {
    ig.add(readFileSync(filePath, "utf8"));
  }
  return ig;
}
