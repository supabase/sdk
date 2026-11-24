import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkDirectory } from "@supabase/doc-check";
import { type Config, main } from "../src/index.ts";
import type { ServeSystem } from "../src/serve.ts";
import {
  type Fixture,
  fixtures,
  pythonFixture,
  swiftFixture,
} from "./fixtures.ts";

let project: string;

/** The pages a preview opened. */
let opened: string[] = [];

/**
 * Stands in for the machine, so that no test starts a docs site: one already
 * listens, and opening a page is only recorded.
 */
const system: ServeSystem = {
  listening: async () => true,
  startDocs: () => {
    throw new Error("A test must not start the docs site.");
  },
  openBrowser: (url) => {
    opened.push(url);
  },
  wait: async () => undefined,
};

beforeEach(() => {
  opened = [];
  project = realpathSync(mkdtempSync(join(tmpdir(), "doc-generator-main-")));
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
});

/**
 * Sets up what an SDK repository has: the tool output and a config file next
 * to it. The definitions go to `out/`.
 */
const setUp = (fixture: Fixture, config: object = {}): void => {
  // Not the package sources, and not the expected output.
  for (const name of readdirSync(fixture.directory)) {
    if (name !== "package" && name !== "expected") {
      cpSync(join(fixture.directory, name), join(project, name), {
        recursive: true,
      });
    }
  }
  writeConfig({ ...fixture.config, output: "out/definitions", ...config });
};

const writeConfig = (
  config: unknown,
  name = "doc-generator.config.mjs",
): void => {
  writeFileSync(
    join(project, name),
    `export default ${JSON.stringify(config, null, 2)};\n`,
  );
};

const run = async (...args: string[]) => {
  let stdout = "";
  let stderr = "";
  const code = await main(
    args,
    {
      stdout: (text) => {
        stdout += text;
      },
      stderr: (text) => {
        stderr += text;
      },
    },
    project,
    system,
  );
  return { code, stdout, stderr };
};

describe("main", () => {
  for (const fixture of fixtures) {
    test(`writes the expected ${fixture.name} definitions from a config file`, async () => {
      setUp(fixture);
      const { code, stderr } = await run();
      expect({ code, stderr }).toEqual({ code: 0, stderr: "" });

      const out = join(project, "out", "definitions");
      const expected = join(fixture.directory, "expected");
      expect(readdirSync(out).sort()).toEqual(readdirSync(expected).sort());
      for (const name of readdirSync(expected)) {
        expect(readFileSync(join(out, name), "utf8")).toBe(
          readFileSync(join(expected, name), "utf8"),
        );
      }
      // The check is a separate program; this is the hand-off between them.
      expect(checkDirectory(out).problems).toEqual([]);
    });
  }

  test("reports what it wrote, and how many functions have no doc comment", async () => {
    setUp(pythonFixture);
    expect((await run()).stdout).toBe(
      [
        "Wrote 15 definitions to out/definitions",
        "Among them, 3 functions without a doc comment",
        "Run with --verbose to list them.",
        "",
      ].join("\n"),
    );
  });

  // A test of its own: a config file is loaded once for each path.
  test("reports how many functions the config excluded", async () => {
    setUp(swiftFixture);
    expect((await run()).stdout).toBe(
      [
        "Wrote 13 definitions to out/definitions",
        "Left out 7 functions excluded by the config",
        "Run with --verbose to list them.",
        "",
      ].join("\n"),
    );
  });

  test("lists the functions without a doc comment, and those left out, with --verbose", async () => {
    setUp(pythonFixture, { exclude: ["^notes\\.client\\.run_all$"] });
    expect((await run("--verbose")).stdout).toBe(
      [
        "Wrote 14 definitions to out/definitions",
        "Among them, 3 functions without a doc comment:",
        "  notes.AsyncNotesClient.archive",
        "  notes.NotesClient.in_folder",
        "  notes.SyncNotesClient.archive",
        "Left out 1 function excluded by the config:",
        "  notes.client.run_all",
        "",
      ].join("\n"),
    );
  });

  test("reports only what it wrote when it left nothing out", async () => {
    const { exclude: _exclude, ...config } = swiftFixture.config;
    setUp(swiftFixture);
    writeConfig({ ...config, output: "out/definitions" });
    for (const args of [[], ["--verbose"]]) {
      expect((await run(...args)).stdout).toBe(
        "Wrote 20 definitions to out/definitions\n",
      );
    }
  });

  test("reads the config named by --config, with paths relative to it", async () => {
    setUp(swiftFixture);
    cpSync(
      join(project, "doc-generator.config.mjs"),
      join(project, "other.config.mjs"),
    );
    rmSync(join(project, "doc-generator.config.mjs"));
    const { code, stdout } = await run("--config", "other.config.mjs");
    expect(code).toBe(0);
    expect(stdout).toStartWith("Wrote 13 definitions to out/definitions\n");
  });

  test("replaces the definitions of the run before", async () => {
    setUp(swiftFixture);
    await run();
    const out = join(project, "out", "definitions");
    const before = readdirSync(out).sort();
    writeFileSync(
      join(out, "notes-client-gone.md"),
      '---\nid: "notes-client-gone"\n---\n',
    );
    await run();
    expect(readdirSync(out).sort()).toEqual(before);
  });

  test("exits 1 with every problem when the config is invalid", async () => {
    writeConfig({ source: { format: "typedoc" }, output: 1 });
    expect(await run()).toEqual({
      code: 1,
      stdout: "",
      stderr: [
        "doc-generator: The config is invalid:",
        "  - source.format must be one of: swift-symbol-graph, griffe",
        "  - output must be a non-empty string",
        "",
      ].join("\n"),
    });
  });

  test("exits 1 when the config file is missing or has no default export", async () => {
    const missing = await run();
    expect(missing.code).toBe(1);
    expect(missing.stderr).toStartWith(
      `doc-generator: Cannot load the config ${join(project, "doc-generator.config.mjs")}: `,
    );

    writeFileSync(
      join(project, "named.config.mjs"),
      "export const config = {};\n",
    );
    expect((await run("--config", "named.config.mjs")).stderr).toBe(
      "doc-generator: The config is invalid:\n  - The config must be an object\n",
    );
  });

  test("exits 1 and writes nothing when an exclusion matches no function", async () => {
    setUp(swiftFixture, { exclude: ["^NotesClient\\.gone$"] });
    expect(await run()).toEqual({
      code: 1,
      stdout: "",
      stderr:
        "doc-generator: Cannot generate the definitions:\n  - exclude: ^NotesClient\\.gone$ matches no function\n",
    });
    expect(readdirSync(project)).not.toContain("out");
  });

  test("exits 1 and writes nothing in strict mode when a function has no doc comment", async () => {
    setUp(pythonFixture, { strict: true });
    expect(await run()).toEqual({
      code: 1,
      stdout: "",
      stderr: [
        "doc-generator: Cannot generate the definitions. `strict` is on: give every function a doc comment, or leave it out with `exclude`:",
        "  - notes.AsyncNotesClient.archive has no doc comment",
        "  - notes.NotesClient.in_folder has no doc comment",
        "  - notes.SyncNotesClient.archive has no doc comment",
        "",
      ].join("\n"),
    });
    expect(readdirSync(project)).not.toContain("out");
  });

  test("turns strict mode on with --strict, whatever the config says", async () => {
    for (const config of [{}, { strict: false }]) {
      setUp(pythonFixture, config);
      const { code, stdout, stderr } = await run("--strict");
      expect({ code, stdout }).toEqual({ code: 1, stdout: "" });
      expect(stderr).toBe(
        [
          "doc-generator: Cannot generate the definitions. `strict` is on: give every function a doc comment, or leave it out with `exclude`:",
          "  - notes.AsyncNotesClient.archive has no doc comment",
          "  - notes.NotesClient.in_folder has no doc comment",
          "  - notes.SyncNotesClient.archive has no doc comment",
          "",
        ].join("\n"),
      );
      expect(readdirSync(project)).not.toContain("out");
    }
  });

  test("changes nothing with --strict when every function has a doc comment", async () => {
    setUp(swiftFixture);
    const { code, stdout } = await run("--strict");
    expect(code).toBe(0);
    expect(stdout).toStartWith("Wrote 13 definitions to out/definitions\n");
  });

  test("leaves the definitions of the run before alone when strict mode fails", async () => {
    setUp(pythonFixture, { strict: true });
    const out = join(project, "out", "definitions");
    mkdirSync(out, { recursive: true });
    const before = '---\nid: "notes-create-client"\n---\n';
    writeFileSync(join(out, "notes-create-client.md"), before);
    expect((await run()).code).toBe(1);
    expect(readdirSync(out)).toEqual(["notes-create-client.md"]);
    expect(readFileSync(join(out, "notes-create-client.md"), "utf8")).toBe(
      before,
    );
  });

  test("exits 1 when a symbol path names no class of the API", async () => {
    setUp(pythonFixture, {
      source: {
        format: "griffe",
        file: "griffe.json",
        // The import path is `notes.SyncNotesClient`.
        symbolPaths: { SyncNotesClient: "client" },
      },
    } satisfies Partial<Config>);
    expect((await run()).stderr).toBe(
      "doc-generator: symbolPaths names what is not the import path of a class with public methods:\n  - SyncNotesClient\n",
    );
  });

  test("lets an error that is a bug through, with its stack trace", async () => {
    // Nothing a person running the generator can fix by changing an input.
    writeFileSync(
      join(project, "doc-generator.config.mjs"),
      'export default new Proxy({}, { ownKeys() { throw new TypeError("a bug"); } });\n',
    );
    expect(run()).rejects.toThrow(new TypeError("a bug"));
  });

  test("exits 1 when the tool output cannot be read", async () => {
    setUp(pythonFixture, {
      source: { format: "griffe", file: "missing.json" },
    } satisfies Partial<Config>);
    const { code, stderr } = await run();
    expect(code).toBe(1);
    expect(stderr).toStartWith("doc-generator: Cannot read the griffe dump: ");
  });

  test("preview copies the generated definitions into a docs checkout", async () => {
    setUp(swiftFixture);
    await run();
    const docs = join(project, "supabase");
    const content = join(docs, "apps", "docs", "content", "reference-beta");
    mkdirSync(content, { recursive: true });

    // The checkout is given relative to where the command runs.
    expect(await run("preview", "supabase", "--copy-only")).toEqual({
      code: 0,
      stdout: [
        `Copied 13 definitions to ${join(content, "swift", "definitions")}`,
        `Wrote a placeholder introduction to ${join(content, "swift", "index.md")}`,
        `Run \`pnpm dev:docs\` in ${docs}, then open http://localhost:3001/docs/reference-beta/swift`,
        "",
      ].join("\n"),
      stderr: "",
    });
    const copied = join(content, "swift", "definitions");
    expect(readdirSync(copied).sort()).toEqual(
      readdirSync(join(project, "out", "definitions")).sort(),
    );
    // What the docs site reads is what the check passed.
    expect(checkDirectory(copied).problems).toEqual([]);
  });

  test("preview opens the page on the docs site, and only copies with --copy-only", async () => {
    setUp(swiftFixture);
    await run();
    mkdirSync(
      join(project, "supabase", "apps", "docs", "content", "reference-beta"),
      { recursive: true },
    );
    const page = "http://localhost:3001/docs/reference-beta/swift";

    const { code, stdout } = await run("preview", "supabase");
    expect(code).toBe(0);
    expect(stdout).toEndWith(`The docs site already runs. Opening ${page}\n`);
    expect(stdout).not.toContain("pnpm dev:docs");
    expect(opened).toEqual([page]);

    opened = [];
    expect((await run("preview", "supabase", "--copy-only")).code).toBe(0);
    expect(opened).toEqual([]);
  });

  test("preview does not write the introduction a second time", async () => {
    setUp(pythonFixture);
    await run();
    mkdirSync(
      join(project, "docs", "apps", "docs", "content", "reference-beta"),
      {
        recursive: true,
      },
    );
    await run("preview", "docs");
    const { code, stdout } = await run(
      "preview",
      "docs",
      "--config",
      "doc-generator.config.mjs",
      "--copy-only",
    );
    expect(code).toBe(0);
    expect(stdout).not.toContain("placeholder");
    expect(stdout).toContain(
      "open http://localhost:3001/docs/reference-beta/python/v3\n",
    );
  });

  test("preview exits 1 when the folder is not a docs checkout", async () => {
    setUp(swiftFixture);
    await run();
    const { code, stderr } = await run("preview", ".");
    expect(code).toBe(1);
    expect(stderr).toStartWith(
      `doc-generator: ${project} has no apps/docs/content/reference-beta.`,
    );
  });

  test("preview exits 1 when the config does not say where the SDK is shown", async () => {
    const { preview: _preview, ...config } = swiftFixture.config;
    setUp(swiftFixture);
    writeConfig({ ...config, output: "out/definitions" });
    expect((await run("preview", ".")).stderr).toBe(
      "doc-generator: The config has no `preview`. Add `preview: { path, title }` to say where the docs site shows this SDK.\n",
    );
  });

  test("exits 2 with the usage text on arguments it does not know", async () => {
    for (const args of [
      ["--out", "x"],
      ["--config"],
      ["--config", "a", "b"],
      ["generate"],
      ["preview"],
      ["preview", "a", "b"],
      // A preview writes no definitions, so it has nothing to list or check.
      ["preview", "a", "--verbose"],
      ["preview", "a", "--strict"],
      // Generating starts no docs site.
      ["--copy-only"],
    ]) {
      const { code, stderr } = await run(...args);
      expect(code).toBe(2);
      expect(stderr).toStartWith("Usage: doc-generator [--config <file>]");
    }
  });

  test("prints the usage text on --help", async () => {
    const { code, stdout } = await run("--help");
    expect(code).toBe(0);
    expect(stdout).toStartWith("Usage: doc-generator [--config <file>]");
  });
});
