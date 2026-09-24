/**
 * Finds the Edge Functions of a Supabase project the way the Supabase CLI
 * does for `functions deploy` and `functions serve`: every directory under
 * `supabase/functions/` with an `index.ts`, merged with the `[functions.<slug>]`
 * entries of `supabase/config.toml`, which can override the entrypoint and
 * import map, turn JWT verification off, or disable a function entirely.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, posix, relative, sep } from "node:path";
import { parse as parseToml } from "smol-toml";

import { compareStrings } from "./collation.ts";

/** Directory of the Supabase project inside the project root. */
export const SUPABASE_DIRECTORY = "supabase";
const FUNCTIONS_DIRECTORY = "functions";
const CONFIG_FILE = "config.toml";
const ENTRYPOINT_FILE = "index.ts";
/** Import maps looked for next to the entrypoint, in order; the last one is deprecated in the CLI. */
const FUNCTION_IMPORT_MAP_FILES = [
  "deno.json",
  "deno.jsonc",
  "import_map.json",
];
/** The shared map the CLI falls back to when a function has none of its own. */
const SHARED_IMPORT_MAP_FILE = "import_map.json";

/** What the CLI accepts as a function slug. */
const SLUG_PATTERN = /^[a-zA-Z0-9_-]+$/;

/** A deployable Edge Function, with paths relative to the project root in POSIX form. */
export interface DiscoveredFunction {
  readonly slug: string;
  readonly entrypoint: string;
  readonly importMap: string | null;
  readonly verifyJwt: boolean;
}

interface FunctionConfig {
  readonly enabled: boolean;
  readonly verifyJwt: boolean;
  readonly importMap: string | null;
  readonly entrypoint: string | null;
}

export interface DiscoverFunctionsOptions {
  /** Absolute path of the directory holding `supabase/`. */
  readonly projectRoot: string;
}

/**
 * List the deployable functions of the project at `projectRoot`, ordered by
 * slug. A function disabled in `config.toml` is left out, since the CLI
 * neither deploys nor serves it.
 */
export async function discoverFunctions(
  options: DiscoverFunctionsOptions,
): Promise<DiscoveredFunction[]> {
  const supabaseDirectory = join(options.projectRoot, SUPABASE_DIRECTORY);
  const functionsDirectory = join(supabaseDirectory, FUNCTIONS_DIRECTORY);
  const configured = await readFunctionsConfig(
    join(supabaseDirectory, CONFIG_FILE),
  );
  const onDisk = await listFunctionDirectories(functionsDirectory);

  const slugs = [...new Set([...onDisk, ...configured.keys()])].sort(
    compareStrings,
  );
  const functions: DiscoveredFunction[] = [];
  for (const slug of slugs) {
    const config = configured.get(slug);
    if (config?.enabled === false) {
      continue;
    }
    const configuredEntrypoint = config?.entrypoint ?? null;
    const configuredImportMap = config?.importMap ?? null;
    if (!onDisk.has(slug) && configuredEntrypoint === null) {
      continue;
    }
    const entrypoint =
      configuredEntrypoint === null
        ? posix.join(
            SUPABASE_DIRECTORY,
            FUNCTIONS_DIRECTORY,
            slug,
            ENTRYPOINT_FILE,
          )
        : resolveConfigPath(
            options.projectRoot,
            supabaseDirectory,
            configuredEntrypoint,
          );
    const importMap =
      configuredImportMap === null
        ? await defaultImportMap(options.projectRoot, entrypoint)
        : resolveConfigPath(
            options.projectRoot,
            supabaseDirectory,
            configuredImportMap,
          );
    functions.push({
      slug,
      entrypoint,
      importMap,
      verifyJwt: config?.verifyJwt ?? true,
    });
  }
  return functions;
}

/**
 * Slugs of the directories under `supabase/functions/` that hold an
 * `index.ts`. A missing directory means no functions; any other error is a
 * real failure and is thrown.
 */
async function listFunctionDirectories(
  functionsDirectory: string,
): Promise<Set<string>> {
  const result = new Set<string>();
  let entries: string[];
  try {
    entries = await readdir(functionsDirectory);
  } catch (error) {
    if (isMissingFile(error)) {
      return result;
    }
    throw error;
  }
  for (const slug of entries) {
    if (
      SLUG_PATTERN.test(slug) &&
      (await isFile(join(functionsDirectory, slug, ENTRYPOINT_FILE)))
    ) {
      result.add(slug);
    }
  }
  return result;
}

/**
 * The import map the CLI uses when `config.toml` names none: `deno.json`,
 * `deno.jsonc` or the deprecated `import_map.json` next to the entrypoint,
 * then the shared `supabase/functions/import_map.json`, then nothing.
 */
async function defaultImportMap(
  projectRoot: string,
  entrypoint: string,
): Promise<string | null> {
  const entrypointDirectory = posix.dirname(entrypoint);
  for (const candidate of FUNCTION_IMPORT_MAP_FILES) {
    const relativePath = posix.join(entrypointDirectory, candidate);
    if (await isFile(join(projectRoot, relativePath))) {
      return relativePath;
    }
  }
  const shared = posix.join(
    SUPABASE_DIRECTORY,
    FUNCTIONS_DIRECTORY,
    SHARED_IMPORT_MAP_FILE,
  );
  return (await isFile(join(projectRoot, shared))) ? shared : null;
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/**
 * The `[functions.<slug>]` tables of `config.toml`. A missing file means no
 * overrides; an unreadable one is a real error and is thrown.
 */
async function readFunctionsConfig(
  configPath: string,
): Promise<Map<string, FunctionConfig>> {
  let source: string;
  try {
    source = await readFile(configPath, "utf8");
  } catch (error) {
    if (isMissingFile(error)) {
      return new Map();
    }
    throw error;
  }
  const document = parseToml(source);
  const functions = document["functions"];
  const result = new Map<string, FunctionConfig>();
  if (!isRecord(functions)) {
    return result;
  }
  for (const [slug, value] of Object.entries(functions)) {
    if (!isRecord(value)) {
      continue;
    }
    result.set(slug, {
      enabled: value["enabled"] !== false,
      verifyJwt: value["verify_jwt"] !== false,
      importMap: nonEmptyString(value["import_map"]),
      entrypoint: nonEmptyString(value["entrypoint"]),
    });
  }
  return result;
}

/**
 * `entrypoint` and `import_map` in `config.toml` are relative to the
 * `supabase/` directory. The result is relative to the project root, in POSIX
 * form, so the document reads the same on every platform.
 */
function resolveConfigPath(
  projectRoot: string,
  supabaseDirectory: string,
  configPath: string,
): string {
  const absolute = posix.isAbsolute(configPath)
    ? configPath
    : join(supabaseDirectory, configPath);
  return relative(projectRoot, absolute).split(sep).join(posix.sep);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
