import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { SymbolGraph } from "./symbol-graph.js";

export function extractSymbolGraphs(sdkRoot: string): SymbolGraph[] {
  const tmpDir = mkdtempSync(join(tmpdir(), "swift-docs-"));

  try {
    const result = spawnSync(
      "swift",
      ["build", "-Xswiftc", "-emit-symbol-graph", "-Xswiftc", "-emit-symbol-graph-dir", tmpDir],
      { cwd: sdkRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );

    if (result.error) {
      throw new Error(`Failed to spawn swift: ${result.error.message}`);
    }
    if (result.status !== 0) {
      throw new Error(`swift build failed:\n${result.stderr}`);
    }

    const graphs: SymbolGraph[] = [];
    for (const file of readdirSync(tmpDir)) {
      if (!file.endsWith(".symbols.json")) continue;
      const raw = readFileSync(join(tmpDir, file), "utf8");
      graphs.push(JSON.parse(raw) as SymbolGraph);
    }

    return graphs;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
