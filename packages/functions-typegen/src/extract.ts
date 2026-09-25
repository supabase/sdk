/**
 * The producer of {@link EdgeFunctionsMetadata}: discovers the functions of a
 * project, documents each entrypoint with `deno doc --json`, follows the
 * project modules its contract imports, and normalizes the result.
 */
import { posix } from "node:path";

import type { DenoRunner } from "./deno.ts";
import { discoverFunctions, type DiscoveredFunction } from "./discovery.ts";
import type { DocModule, DocOutput } from "./doc-nodes.ts";
import { normalizeContract } from "./normalize.ts";
import { sortEdgeFunctionsMetadata } from "./sort.ts";
import {
  EDGE_FUNCTIONS_METADATA_VERSION,
  type Diagnostic,
  type EdgeFunction,
  type EdgeFunctionsMetadata,
} from "./types.ts";

export interface ExtractEdgeFunctionsMetadataOptions {
  /** Absolute path of the directory holding `supabase/`. */
  readonly projectRoot: string;
  /** How to run Deno; see {@link createLocalDenoRunner} for the host binary. */
  readonly deno: DenoRunner;
  /**
   * The functions to extract. Defaults to {@link discoverFunctions} on the
   * project, so pass this to narrow the set or to feed a manifest resolved
   * elsewhere.
   */
  readonly functions?: readonly DiscoveredFunction[];
}

/** How many rounds of following imports into new project modules to allow. */
const MAX_IMPORT_ROUNDS = 16;

/**
 * Extract the contracts of every deployable Edge Function of the project. A
 * function whose entrypoint cannot be documented keeps its place in the
 * result with both bodies `null` and a diagnostic saying why, so one broken
 * function does not hide the others.
 */
export async function extractEdgeFunctionsMetadata(
  options: ExtractEdgeFunctionsMetadataOptions,
): Promise<EdgeFunctionsMetadata> {
  const functions =
    options.functions ??
    (await discoverFunctions({ projectRoot: options.projectRoot }));
  const extracted: EdgeFunction[] = [];
  const diagnostics: Diagnostic[] = [];
  const denoProblem =
    functions.length === 0 ? undefined : await probeDeno(options);
  for (const fn of functions) {
    if (denoProblem !== undefined) {
      extracted.push(withoutContract(fn));
      continue;
    }
    const result = await extractFunction(fn, options);
    extracted.push(result.function);
    diagnostics.push(...result.diagnostics);
  }
  if (denoProblem !== undefined) {
    diagnostics.push({ slug: "", path: "", message: denoProblem });
  }
  return sortEdgeFunctionsMetadata({
    version: EDGE_FUNCTIONS_METADATA_VERSION,
    functions: extracted,
    diagnostics,
  });
}

/**
 * One `deno --version` before any `deno doc`, so a machine without Deno gets
 * a single project-level diagnostic and every function listed by name,
 * instead of the same failure repeated per function.
 */
async function probeDeno(
  options: ExtractEdgeFunctionsMetadataOptions,
): Promise<string | undefined> {
  const result = await options.deno.run({
    args: ["--version"],
    projectRoot: options.projectRoot,
  });
  if (result.exitCode === 0) {
    return undefined;
  }
  return `Deno is needed to read Edge Function contracts, but \`deno --version\` failed, so every function is listed without one:\n${result.stderr.trim()}`;
}

function withoutContract(fn: DiscoveredFunction): EdgeFunction {
  return {
    slug: fn.slug,
    entrypoint: fn.entrypoint,
    importMap: fn.importMap,
    verifyJwt: fn.verifyJwt,
    requestBody: null,
    responseBody: null,
    types: [],
  };
}

interface FunctionResult {
  readonly function: EdgeFunction;
  readonly diagnostics: Diagnostic[];
}

async function extractFunction(
  fn: DiscoveredFunction,
  options: ExtractEdgeFunctionsMetadataOptions,
): Promise<FunctionResult> {
  const base = withoutContract(fn);
  const documented = await documentFunction(fn, options);
  if ("error" in documented) {
    return {
      function: base,
      diagnostics: [{ slug: fn.slug, path: "", message: documented.error }],
    };
  }
  const contract = normalizeContract({
    slug: fn.slug,
    entrypointUrl: documented.entrypointUrl,
    modules: documented.modules,
    describeModule: (url) => describeModule(url, documented.projectRootPath),
  });
  return {
    function: {
      ...base,
      requestBody: contract.requestBody,
      responseBody: contract.responseBody,
      types: contract.types,
    },
    diagnostics: contract.diagnostics,
  };
}

interface DocumentedFunction {
  readonly entrypointUrl: string;
  readonly modules: Map<string, DocModule>;
  /** POSIX path of the project root as it appears in the documented URLs. */
  readonly projectRootPath: string;
}

/**
 * Run `deno doc` on the entrypoint from the project root, with the function's
 * import map passed as `--import-map` (a `deno.json` is a valid import map)
 * and `--no-config`, so no other configuration on disk changes resolution.
 * Then keep documenting the project modules that contract types are imported
 * from until none are missing.
 */
async function documentFunction(
  fn: DiscoveredFunction,
  options: ExtractEdgeFunctionsMetadataOptions,
): Promise<DocumentedFunction | { error: string }> {
  const args = [
    "doc",
    "--json",
    "--private",
    "--no-lock",
    "--no-config",
    ...(fn.importMap === null ? [] : ["--import-map", fn.importMap]),
  ];

  const modules = new Map<string, DocModule>();
  let targets = [fn.entrypoint];
  let entrypointUrl: string | undefined;
  let projectRootPath: string | undefined;
  for (
    let round = 0;
    round < MAX_IMPORT_ROUNDS && targets.length > 0;
    round += 1
  ) {
    const result = await options.deno.run({
      args: [...args, ...targets],
      projectRoot: options.projectRoot,
    });
    if (result.exitCode !== 0) {
      return {
        error: `deno doc failed for ${fn.entrypoint}:\n${result.stderr.trim()}`,
      };
    }
    let output: unknown;
    try {
      output = JSON.parse(result.stdout);
    } catch {
      return {
        error: `deno doc produced no JSON for ${fn.entrypoint}:\n${result.stderr.trim()}`,
      };
    }
    if (!isDocOutput(output)) {
      return {
        error: `deno doc produced an unsupported document for ${fn.entrypoint}; version 2 with modules keyed by URL is expected.`,
      };
    }
    for (const [url, module] of Object.entries(output.nodes)) {
      modules.set(url, module);
    }
    if (entrypointUrl === undefined) {
      entrypointUrl = Object.keys(output.nodes).find((url) =>
        url.endsWith(`/${fn.entrypoint}`),
      );
      if (entrypointUrl === undefined) {
        return { error: `deno doc did not document ${fn.entrypoint}.` };
      }
      const entrypointPath = urlPath(entrypointUrl);
      projectRootPath = entrypointPath.slice(
        0,
        entrypointPath.length - fn.entrypoint.length - 1,
      );
    }
    targets = missingProjectModules(modules).map((url) =>
      posix.relative(projectRootPath!, urlPath(url)),
    );
  }
  if (entrypointUrl === undefined || projectRootPath === undefined) {
    return { error: `deno doc did not document ${fn.entrypoint}.` };
  }
  return { entrypointUrl, modules, projectRootPath };
}

/** The document version this package reads; another version needs a look at `doc-nodes.ts` first. */
const DOC_OUTPUT_VERSION = 2;

function isDocOutput(value: unknown): value is DocOutput {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as { version?: unknown; nodes?: unknown };
  return (
    record.version === DOC_OUTPUT_VERSION &&
    typeof record.nodes === "object" &&
    record.nodes !== null &&
    !Array.isArray(record.nodes)
  );
}

/**
 * URLs of project modules that a documented module imports a type from and
 * that are not documented yet. Only `file:` modules count: types from npm,
 * JSR or remote modules are reported as unsupported by the normalizer.
 */
function missingProjectModules(
  modules: ReadonlyMap<string, DocModule>,
): string[] {
  const missing = new Set<string>();
  for (const module of modules.values()) {
    const referenced = importedTypeNames(module.symbols);
    for (const imported of module.imports ?? []) {
      if (
        referenced.has(imported.importedName) &&
        imported.src.startsWith("file:") &&
        !modules.has(imported.src)
      ) {
        missing.add(imported.src);
      }
    }
  }
  return [...missing].sort();
}

/** Names (first segment) of every imported type referenced anywhere in the symbols. */
function importedTypeNames(
  value: unknown,
  names = new Set<string>(),
): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) {
      importedTypeNames(item, names);
    }
    return names;
  }
  if (typeof value !== "object" || value === null) {
    return names;
  }
  const record = value as Record<string, unknown>;
  if (record["kind"] === "typeRef") {
    const ref = record["value"] as
      | { typeName?: string; resolution?: { kind?: string } }
      | undefined;
    if (
      ref?.resolution?.kind === "import" &&
      typeof ref.typeName === "string"
    ) {
      names.add(ref.typeName.split(".")[0]!);
    }
  }
  for (const child of Object.values(record)) {
    importedTypeNames(child, names);
  }
  return names;
}

/**
 * POSIX-style path of a `file:` URL, the same on every host. `fileURLToPath`
 * would return a backslash path on Windows, which the `posix` functions used
 * throughout cannot split; the URL pathname (`/C:/project/...`) works with them
 * everywhere, and only relative paths derived from it ever reach Deno.
 */
function urlPath(url: string): string {
  return decodeURIComponent(new URL(url).pathname);
}

/** Show a module as a project-relative path when it lives under the project root. */
function describeModule(url: string, projectRootPath: string): string {
  if (!url.startsWith("file:")) {
    return url;
  }
  const relativePath = posix.relative(projectRootPath, urlPath(url));
  return relativePath.startsWith("..") ? url : relativePath;
}
