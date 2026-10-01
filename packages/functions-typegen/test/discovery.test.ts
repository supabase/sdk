import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { discoverFunctions } from "../src/discovery.ts";

const fixtureProject = join(import.meta.dir, "fixtures", "project");

describe("discoverFunctions", () => {
  test("merges the functions directory with config.toml the way the CLI does", async () => {
    const functions = await discoverFunctions({ projectRoot: fixtureProject });
    expect(functions).toEqual([
      {
        slug: "broken",
        entrypoint: "supabase/functions/broken/index.ts",
        importMap: null,
        verifyJwt: true,
      },
      // Declared in config.toml only, with its own entrypoint and import map
      // relative to the supabase/ directory.
      {
        slug: "custom-entry",
        entrypoint: "supabase/custom/handler.ts",
        importMap: "supabase/custom/import_map.json",
        verifyJwt: false,
      },
      // A deno.json next to the entrypoint is the default import map.
      {
        slug: "greet",
        entrypoint: "supabase/functions/greet/index.ts",
        importMap: "supabase/functions/greet/deno.json",
        verifyJwt: true,
      },
      {
        slug: "no-contract",
        entrypoint: "supabase/functions/no-contract/index.ts",
        importMap: null,
        verifyJwt: true,
      },
      {
        slug: "not-exported",
        entrypoint: "supabase/functions/not-exported/index.ts",
        importMap: null,
        verifyJwt: true,
      },
      {
        slug: "public-greet",
        entrypoint: "supabase/functions/public-greet/index.ts",
        importMap: null,
        verifyJwt: false,
      },
    ]);
  });

  test("leaves out disabled functions, directories without an entrypoint and config-only slugs without one", async () => {
    const slugs = (
      await discoverFunctions({ projectRoot: fixtureProject })
    ).map((fn) => fn.slug);
    expect(slugs).not.toContain("disabled-fn");
    expect(slugs).not.toContain("_shared");
    expect(slugs).not.toContain("ghost");
  });

  test("works without a config.toml and without a functions directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "functions-typegen-"));
    expect(await discoverFunctions({ projectRoot: root })).toEqual([]);

    await mkdir(join(root, "supabase", "functions", "hello"), {
      recursive: true,
    });
    await writeFile(
      join(root, "supabase", "functions", "hello", "index.ts"),
      "",
    );
    expect(await discoverFunctions({ projectRoot: root })).toEqual([
      {
        slug: "hello",
        entrypoint: "supabase/functions/hello/index.ts",
        importMap: null,
        verifyJwt: true,
      },
    ]);
  });

  test("prefers deno.json over deno.jsonc and honours an explicit import_map", async () => {
    const root = await mkdtemp(join(tmpdir(), "functions-typegen-"));
    const functionsDirectory = join(root, "supabase", "functions");
    await mkdir(join(functionsDirectory, "both"), { recursive: true });
    await mkdir(join(functionsDirectory, "jsonc"), { recursive: true });
    await mkdir(join(functionsDirectory, "explicit"), { recursive: true });
    for (const slug of ["both", "jsonc", "explicit"]) {
      await writeFile(join(functionsDirectory, slug, "index.ts"), "");
    }
    await writeFile(join(functionsDirectory, "both", "deno.json"), "{}");
    await writeFile(join(functionsDirectory, "both", "deno.jsonc"), "{}");
    await writeFile(join(functionsDirectory, "jsonc", "deno.jsonc"), "{}");
    await writeFile(join(functionsDirectory, "explicit", "deno.json"), "{}");
    await writeFile(
      join(root, "supabase", "config.toml"),
      '[functions.explicit]\nimport_map = "./import_map.json"\n',
    );

    const byslug = new Map(
      (await discoverFunctions({ projectRoot: root })).map((fn) => [
        fn.slug,
        fn,
      ]),
    );
    expect(byslug.get("both")?.importMap).toBe(
      "supabase/functions/both/deno.json",
    );
    expect(byslug.get("jsonc")?.importMap).toBe(
      "supabase/functions/jsonc/deno.jsonc",
    );
    expect(byslug.get("explicit")?.importMap).toBe("supabase/import_map.json");
  });

  test("falls back to a deprecated import_map.json next to the entrypoint, then to the shared one", async () => {
    const root = await mkdtemp(join(tmpdir(), "functions-typegen-"));
    const functionsDirectory = join(root, "supabase", "functions");
    for (const slug of ["local-map", "shared-map"]) {
      await mkdir(join(functionsDirectory, slug), { recursive: true });
      await writeFile(join(functionsDirectory, slug, "index.ts"), "");
    }
    await writeFile(
      join(functionsDirectory, "local-map", "import_map.json"),
      "{}",
    );
    await writeFile(join(functionsDirectory, "import_map.json"), "{}");
    await mkdir(join(root, "supabase", "custom"), { recursive: true });
    await writeFile(join(root, "supabase", "custom", "handler.ts"), "");
    await writeFile(join(root, "supabase", "custom", "deno.json"), "{}");
    await writeFile(
      join(root, "supabase", "config.toml"),
      '[functions.custom]\nentrypoint = "./custom/handler.ts"\n',
    );

    const byslug = new Map(
      (await discoverFunctions({ projectRoot: root })).map((fn) => [
        fn.slug,
        fn.importMap,
      ]),
    );
    expect(byslug.get("local-map")).toBe(
      "supabase/functions/local-map/import_map.json",
    );
    expect(byslug.get("shared-map")).toBe("supabase/functions/import_map.json");
    // A config-only entrypoint looks next to itself, not under functions/<slug>/.
    expect(byslug.get("custom")).toBe("supabase/custom/deno.json");
  });

  test("throws when the functions directory exists but cannot be read", async () => {
    const root = await mkdtemp(join(tmpdir(), "functions-typegen-"));
    await mkdir(join(root, "supabase"), { recursive: true });
    await writeFile(join(root, "supabase", "functions"), "not a directory");
    let error: unknown;
    try {
      await discoverFunctions({ projectRoot: root });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(Error);
  });

  test("throws on an unreadable config.toml instead of guessing", async () => {
    const root = await mkdtemp(join(tmpdir(), "functions-typegen-"));
    await mkdir(join(root, "supabase"), { recursive: true });
    await writeFile(join(root, "supabase", "config.toml"), "[functions\n");
    let error: unknown;
    try {
      await discoverFunctions({ projectRoot: root });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(Error);
  });
});
