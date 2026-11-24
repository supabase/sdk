import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { type Config, parseConfig } from "./config.ts";
import { GeneratorError } from "./errors.ts";
import type { PreviewResult } from "./preview.ts";
import { type RunResult, runGenerator, runPreview } from "./run.ts";
import { localSystem, type ServeSystem, serveDocs } from "./serve.ts";

export interface Output {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

const DEFAULT_CONFIG = "doc-generator.config.mjs";

const USAGE = `Usage: doc-generator [--config <file>] [--verbose] [--strict]
       doc-generator preview <docs-checkout> [--config <file>] [--copy-only]

Generates the API docs definition files of an SDK: one for each public
function, with a doc comment or without one. --verbose lists the functions
that have none. --strict makes each of them an error, as \`strict: true\` in
the config does.

preview copies the definitions that were generated into a local checkout of
supabase/supabase, where the docs site reads them. Then it starts the docs site
there (pnpm dev:docs), unless it already runs, and opens the page in a browser.
It shows the definitions as supabase.com will. Ctrl-C stops the docs site.
--copy-only only copies them.

The config defaults to ./${DEFAULT_CONFIG}.
`;

const count = (names: readonly string[]): string =>
  `${names.length} ${names.length === 1 ? "function" : "functions"}`;

/**
 * What a run did: what it wrote without a doc comment, and what it left out.
 * The names can run to hundreds, so they are listed only when `verbose`.
 */
export function formatReport(
  result: RunResult,
  cwd: string,
  verbose = false,
): string {
  const lines = [
    `Wrote ${result.files.length} definitions to ${relative(cwd, result.output) || "."}`,
  ];
  const groups: [readonly string[], string][] = [
    [
      result.undocumented,
      `Among them, ${count(result.undocumented)} without a doc comment`,
    ],
    [
      result.excluded,
      `Left out ${count(result.excluded)} excluded by the config`,
    ],
  ];
  for (const [names, headline] of groups) {
    if (names.length > 0) {
      lines.push(
        `${headline}${verbose ? ":" : ""}`,
        ...(verbose ? names.map((name) => `  ${name}`) : []),
      );
    }
  }
  if (!verbose && groups.some(([names]) => names.length > 0)) {
    lines.push("Run with --verbose to list them.");
  }
  return `${lines.join("\n")}\n`;
}

/**
 * What a preview copied. When it does not start the docs site itself, also
 * how to look at the copy.
 */
export function formatPreview(
  result: PreviewResult,
  docs: string,
  copyOnly = true,
): string {
  const lines = [
    `Copied ${result.definitions} definitions to ${result.directory}`,
  ];
  if (result.index !== undefined) {
    lines.push(`Wrote a placeholder introduction to ${result.index}`);
  }
  if (copyOnly) {
    lines.push(`Run \`pnpm dev:docs\` in ${docs}, then open ${result.url}`);
  }
  return `${lines.join("\n")}\n`;
}

/** What the arguments ask for. `undefined` when they ask for nothing known. */
type Command =
  | { readonly name: "help" }
  | {
      readonly name: "generate";
      readonly config: string;
      readonly verbose: boolean;
      /** Turns strict mode on whatever the config says. */
      readonly strict: boolean;
    }
  | {
      readonly name: "preview";
      readonly config: string;
      readonly docs: string;
      /** Copies the definitions without starting the docs site. */
      readonly copyOnly: boolean;
    };

function parseCommand(args: readonly string[]): Command | undefined {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...args],
      allowPositionals: true,
      options: {
        config: { type: "string" },
        verbose: { type: "boolean" },
        strict: { type: "boolean" },
        "copy-only": { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch {
    return undefined;
  }
  const { values, positionals } = parsed;
  if (values.help) {
    return { name: "help" };
  }
  const config = values.config ?? DEFAULT_CONFIG;
  const [command, docs, ...extra] = positionals;
  if (command === undefined) {
    // Generating starts no docs site, so there is nothing to copy only.
    return values["copy-only"]
      ? undefined
      : {
          name: "generate",
          config,
          verbose: values.verbose ?? false,
          strict: values.strict ?? false,
        };
  }
  // A preview writes no definitions, so it has nothing to list or check.
  return command === "preview" &&
    docs !== undefined &&
    extra.length === 0 &&
    !values.verbose &&
    !values.strict
    ? { name: "preview", config, docs, copyOnly: values["copy-only"] ?? false }
    : undefined;
}

async function loadConfig(path: string): Promise<Config> {
  let module: { default?: unknown };
  try {
    module = (await import(pathToFileURL(path).href)) as typeof module;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new GeneratorError(`Cannot load the config ${path}: ${reason}`);
  }
  return parseConfig(module.default);
}

/**
 * Runs the command line and returns the exit code. `system` starts the docs
 * site for a preview.
 */
export async function main(
  args: readonly string[],
  output: Output,
  cwd: string = process.cwd(),
  system: ServeSystem = localSystem,
): Promise<number> {
  const command = parseCommand(args);
  if (command === undefined) {
    output.stderr(USAGE);
    return 2;
  }
  if (command.name === "help") {
    output.stdout(USAGE);
    return 0;
  }

  const path = resolve(cwd, command.config);
  try {
    const config = await loadConfig(path);
    if (command.name === "preview") {
      const docs = resolve(cwd, command.docs);
      const result = runPreview(config, dirname(path), docs);
      output.stdout(formatPreview(result, docs, command.copyOnly));
      if (!command.copyOnly) {
        return await serveDocs(docs, result.url, system, output.stdout);
      }
    } else {
      const run = command.strict ? { ...config, strict: true } : config;
      output.stdout(
        formatReport(runGenerator(run, dirname(path)), cwd, command.verbose),
      );
    }
    return 0;
  } catch (error) {
    // A GeneratorError is something the person running this can fix, so it
    // gets a message. Anything else is a bug and keeps its stack trace.
    if (!(error instanceof GeneratorError)) {
      throw error;
    }
    output.stderr(`doc-generator: ${error.message}\n`);
    return 1;
  }
}
