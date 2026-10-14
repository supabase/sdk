/**
 * The producer of the `edgeFunctions` collection of `GeneratorMetadata`:
 * discovers the functions of a project, parses each entrypoint and the
 * project modules its contract imports, and normalizes the exported
 * `RequestBody` and `ResponseBody` types. Everything runs in this process on
 * the project's source files; nothing is executed and no network is used.
 */
import { readFileSync } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  type EdgeFunction,
  type EdgeFunctionDiagnostic,
  sortEdgeFunctions,
} from "@supabase/postgrest-typegen";
import { discoverFunctions, type DiscoveredFunction } from "./discovery.ts";
import type { ModuleModel, ModuleSource } from "./module-model.ts";
import { normalizeContract } from "./normalize.ts";
import { parseModule } from "./parse.ts";
import {
  createSpecifierResolver,
  parseImportMap,
  type SpecifierResolver,
} from "./resolve.ts";

export interface ExtractEdgeFunctionsOptions {
  /** Absolute path of the directory holding `supabase/`. */
  readonly projectRoot: string;
  /**
   * The functions to extract. Defaults to {@link discoverFunctions} on the
   * project; pass this to narrow the set or to feed a manifest resolved
   * elsewhere.
   */
  readonly functions?: readonly DiscoveredFunction[];
}

/**
 * Extract the contract of every deployable Edge Function of the project,
 * sorted by slug. A function whose entrypoint cannot be read keeps its place
 * with both bodies `null` and a diagnostic saying why, so one broken
 * function does not hide the others. Merge the result into the metadata the
 * database introspection produced:
 *
 * ```ts
 * const metadata = { ...(await introspect(db)), edgeFunctions: await extractEdgeFunctions({ projectRoot }) };
 * ```
 */
export async function extractEdgeFunctions(
  options: ExtractEdgeFunctionsOptions,
): Promise<EdgeFunction[]> {
  const functions =
    options.functions ??
    (await discoverFunctions({ projectRoot: options.projectRoot }));
  return sortEdgeFunctions(
    functions.map((fn) => extractFunction(fn, options.projectRoot)),
  );
}

function extractFunction(
  fn: DiscoveredFunction,
  projectRoot: string,
): EdgeFunction {
  const base: EdgeFunction = {
    slug: fn.slug,
    entrypoint: fn.entrypoint,
    importMap: fn.importMap,
    verifyJwt: fn.verifyJwt,
    requestBody: null,
    responseBody: null,
    types: [],
    diagnostics: [],
  };
  const entrypointPath = join(projectRoot, fn.entrypoint);
  const entrypointSource = readSource(entrypointPath);
  if (entrypointSource === undefined) {
    return {
      ...base,
      diagnostics: [
        {
          path: "",
          message: `The entrypoint ${fn.entrypoint} does not exist or cannot be read.`,
        },
      ],
    };
  }
  const diagnostics: EdgeFunctionDiagnostic[] = [];
  const resolve = createResolver(fn, projectRoot, diagnostics);
  const describeModule = (url: string) =>
    describeProjectModule(url, projectRoot);
  const loader = new ModuleLoader(resolve, describeModule, diagnostics);
  const entrypointUrl = pathToFileURL(entrypointPath).href;
  loader.load(entrypointUrl, entrypointSource);
  const contract = normalizeContract({
    entrypointUrl,
    modules: loader,
    describeModule,
  });
  return {
    ...base,
    requestBody: contract.requestBody,
    responseBody: contract.responseBody,
    types: contract.types,
    diagnostics: [...diagnostics, ...contract.diagnostics],
  };
}

function createResolver(
  fn: DiscoveredFunction,
  projectRoot: string,
  diagnostics: EdgeFunctionDiagnostic[],
): SpecifierResolver {
  if (fn.importMap === null) {
    return createSpecifierResolver();
  }
  const importMapPath = isAbsolute(fn.importMap)
    ? fn.importMap
    : join(projectRoot, fn.importMap);
  const source = readSource(importMapPath);
  if (source === undefined) {
    diagnostics.push({
      path: "",
      message: `The import map ${fn.importMap} does not exist or cannot be read; bare specifiers stay unresolved.`,
    });
    return createSpecifierResolver();
  }
  return createSpecifierResolver(parseImportMap(importMapPath, source));
}

/** Parses project modules on first use and remembers them, so a shared type is read once. */
class ModuleLoader implements ModuleSource {
  private readonly modules = new Map<string, ModuleModel | undefined>();

  private readonly resolve: SpecifierResolver;
  private readonly describeModule: (url: string) => string;
  private readonly diagnostics: EdgeFunctionDiagnostic[];

  constructor(
    resolve: SpecifierResolver,
    describeModule: (url: string) => string,
    diagnostics: EdgeFunctionDiagnostic[],
  ) {
    this.resolve = resolve;
    this.describeModule = describeModule;
    this.diagnostics = diagnostics;
  }

  load(url: string, source: string): ModuleModel {
    const model = parseModule({ url, source, resolve: this.resolve });
    for (const error of model.parseErrors ?? []) {
      this.diagnostics.push({
        path: "",
        message: `Syntax error in ${this.describeModule(url)} at ${error}.`,
      });
    }
    this.modules.set(url, model);
    return model;
  }

  get(url: string): ModuleModel | undefined {
    if (this.modules.has(url)) {
      return this.modules.get(url);
    }
    if (!url.startsWith("file:")) {
      return undefined;
    }
    const source = readSource(fileURLToPath(url));
    if (source === undefined) {
      this.modules.set(url, undefined);
      return undefined;
    }
    return this.load(url, source);
  }

  has(url: string): boolean {
    return this.get(url) !== undefined;
  }
}

function readSource(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

/** Show a module as a project-relative POSIX path when it lives under the project root. */
function describeProjectModule(url: string, projectRoot: string): string {
  if (!url.startsWith("file:")) {
    return url;
  }
  const relativePath = relative(projectRoot, fileURLToPath(url));
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return url;
  }
  return relativePath.split(sep).join("/");
}
