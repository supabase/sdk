import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { createSpecifierResolver, parseImportMap } from "../src/resolve.ts";

async function project(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "edge-functions-resolve-"));
  await mkdir(join(root, "functions", "greet"), { recursive: true });
  await mkdir(join(root, "functions", "_shared", "deep"), { recursive: true });
  await writeFile(join(root, "functions", "greet", "index.ts"), "");
  await writeFile(join(root, "functions", "_shared", "types.ts"), "");
  await writeFile(join(root, "functions", "_shared", "deep", "index.ts"), "");
  await writeFile(join(root, "functions", "_shared", "module.tsx"), "");
  return root;
}

describe("createSpecifierResolver", () => {
  test("resolves relative specifiers against the importing module, with extension fallbacks", async () => {
    const root = await project();
    const resolve = createSpecifierResolver();
    const importer = pathToFileURL(
      join(root, "functions", "greet", "index.ts"),
    ).href;
    const shared = pathToFileURL(
      join(root, "functions", "_shared", "types.ts"),
    ).href;
    expect(resolve("../_shared/types.ts", importer)).toBe(shared);
    expect(resolve("../_shared/types", importer)).toBe(shared);
    expect(resolve("../_shared/types.js", importer)).toBe(shared);
    expect(resolve("../_shared/module", importer)).toBe(
      pathToFileURL(join(root, "functions", "_shared", "module.tsx")).href,
    );
    expect(resolve("../_shared/deep", importer)).toBe(
      pathToFileURL(join(root, "functions", "_shared", "deep", "index.ts"))
        .href,
    );
    expect(resolve("../_shared/missing.ts", importer)).toBeNull();
  });

  test("leaves package and remote specifiers as they are", async () => {
    const resolve = createSpecifierResolver();
    expect(resolve("npm:zod@4", "file:///p/index.ts")).toBe("npm:zod@4");
    expect(resolve("jsr:@std/path", "file:///p/index.ts")).toBe(
      "jsr:@std/path",
    );
    expect(resolve("https://esm.sh/x", "file:///p/index.ts")).toBe(
      "https://esm.sh/x",
    );
    expect(resolve("node:fs", "file:///p/index.ts")).toBe("node:fs");
    expect(resolve("zod", "file:///p/index.ts")).toBe("zod");
  });

  test("applies an import map: exact keys, prefix keys and scopes, relative to the map file", async () => {
    const root = await project();
    const mapPath = join(root, "functions", "greet", "deno.json");
    const importMap = parseImportMap(
      mapPath,
      `{
        // a comment, as deno.jsonc allows
        "imports": {
          "@shared/": "../_shared/",
          "types": "../_shared/types.ts",
          "zod": "npm:zod@4",
        },
        "scopes": { "../_shared/": { "zod": "npm:zod@3" } },
      }`,
    );
    const resolve = createSpecifierResolver(importMap);
    const importer = pathToFileURL(
      join(root, "functions", "greet", "index.ts"),
    ).href;
    const shared = pathToFileURL(
      join(root, "functions", "_shared", "types.ts"),
    ).href;
    expect(resolve("@shared/types.ts", importer)).toBe(shared);
    expect(resolve("types", importer)).toBe(shared);
    expect(resolve("zod", importer)).toBe("npm:zod@4");
    expect(resolve("zod", shared)).toBe("npm:zod@3");
    expect(resolve("@shared/missing.ts", importer)).toBeNull();
    expect(resolve("./index.ts", importer)).toBe(importer);
  });
});
