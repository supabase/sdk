/**
 * The producer of {@link EdgeFunctionsMetadata}: discovers the functions of a
 * project, documents each entrypoint with `deno doc --json`, follows the
 * project modules its contract imports, and normalizes the result.
 */
import { posix } from "node:path";
import { fileURLToPath } from "node:url";

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
  for (const fn of functions) {
    const result = await extractFunction(fn, options);
    extracted.push(result.function);
    diagnostics.push(...result.diagnostics);
  }
  return sortEdgeFunctionsMetadata({
    version: EDGE_FUNCTIONS_METADATA_VERSION,
    functions: extracted,
    diagnostics,
  });
}

interface FunctionResult {
  readonly function: EdgeFunction;
  readonly diagnostics: Diagnostic[];
}

async function extractFunction(
  fn: DiscoveredFunction,
  options: ExtractEdgeFunctionsMetadataOptions,
): Promise<FunctionResult> {
  const base: EdgeFunction = {
    slug: fn.slug,
    entrypoint: fn.entrypoint,
    importMap: fn.importMap,
    verifyJwt: fn.verifyJwt,
    requestBody: null,
    responseBody: null,
    types: [],
  };
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
  /** Path of the project root as the Deno runner sees it. */
  readonly projectRootPath: string;
}

/**
 * Run `deno doc` on the entrypoint from its own directory, so a `deno.json`
 * next to it resolves the way it does for the edge runtime, then keep
 * documenting the project modules that contract types are imported from
 * until none are missing.
 */
async function documentFunction(
  fn: DiscoveredFunction,
  options: ExtractEdgeFunctionsMetadataOptions,
): Promise<DocumentedFunction | { error: string }> {
  const cwd = posix.dirname(fn.entrypoint);
  const entryFile = posix.basename(fn.entrypoint);
  const args = [
    "doc",
    "--json",
    "--private",
    "--no-lock",
    ...importMapArguments(fn, cwd),
  ];

  const modules = new Map<string, DocModule>();
  let targets = [entryFile];
  let entrypointUrl: string | undefined;
  let entryDirectoryPath: string | undefined;
  for (
    let round = 0;
    round < MAX_IMPORT_ROUNDS && targets.length > 0;
    round += 1
  ) {
    const result = await options.deno.run({
      args: [...args, ...targets],
      cwd,
      projectRoot: options.projectRoot,
    });
    if (result.exitCode !== 0) {
      return {
        error: `deno doc failed for ${fn.entrypoint}:\n${result.stderr.trim()}`,
      };
    }
    let output: DocOutput;
    try {
      output = JSON.parse(result.stdout) as DocOutput;
    } catch {
      return {
        error: `deno doc produced no JSON for ${fn.entrypoint}:\n${result.stderr.trim()}`,
      };
    }
    for (const [url, module] of Object.entries(output.nodes)) {
      modules.set(url, module);
    }
    if (entrypointUrl === undefined) {
      entrypointUrl = Object.keys(output.nodes).find((url) =>
        url.endsWith(`/${entryFile}`),
      );
      if (entrypointUrl === undefined) {
        return { error: `deno doc did not document ${fn.entrypoint}.` };
      }
      entryDirectoryPath = posix.dirname(fileURLToPath(entrypointUrl));
    }
    targets = missingProjectModules(modules).map((url) =>
      posix.relative(entryDirectoryPath!, fileURLToPath(url)),
    );
  }
  if (entrypointUrl === undefined || entryDirectoryPath === undefined) {
    return { error: `deno doc did not document ${fn.entrypoint}.` };
  }
  const depth = cwd.split("/").length;
  const projectRootPath = posix.join(
    entryDirectoryPath,
    ...Array<string>(depth).fill(".."),
  );
  return { entrypointUrl, modules, projectRootPath };
}

function importMapArguments(fn: DiscoveredFunction, cwd: string): string[] {
  if (fn.importMap === null) {
    return ["--no-config"];
  }
  const relativePath = posix.relative(cwd, fn.importMap);
  const isDenoConfig = /deno\.jsonc?$/.test(fn.importMap);
  return [isDenoConfig ? "--config" : "--import-map", relativePath];
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

/** Show a module as a project-relative path when it lives under the project root. */
function describeModule(url: string, projectRootPath: string): string {
  if (!url.startsWith("file:")) {
    return url;
  }
  const relativePath = posix.relative(projectRootPath, fileURLToPath(url));
  return relativePath.startsWith("..") ? url : relativePath;
}
