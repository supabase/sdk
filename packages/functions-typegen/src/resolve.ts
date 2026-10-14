/**
 * Turns the specifiers a function imports into module URLs the way Deno
 * would, without running Deno: relative paths against the importing module,
 * bare names through the function's import map (`deno.json`,
 * `deno.jsonc` or `import_map.json`, all read as JSON with comments), and
 * everything else left as the `npm:`, `jsr:` or `https:` specifier it is,
 * which the normalizer reports as outside the project.
 */
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseJsonc } from "jsonc-parser";

export interface ImportMap {
  /** Resolved against `baseUrl`, so targets are URLs or bare specifiers. */
  readonly imports: Readonly<Record<string, string>>;
  /** Scope URL to its own imports, longest scope wins. */
  readonly scopes: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** URL of the import map file; relative targets resolve against it. */
  readonly baseUrl: string;
}

/** Parse an import map file (plain JSON or JSON with comments). */
export function parseImportMap(path: string, source: string): ImportMap {
  const document = parseJsonc(source) as unknown;
  const record = isRecord(document) ? document : {};
  const baseUrl = pathToFileURL(path).href;
  return {
    imports: stringRecord(record["imports"]),
    scopes: Object.fromEntries(
      Object.entries(isRecord(record["scopes"]) ? record["scopes"] : {}).map(
        ([scope, map]) => [new URL(scope, baseUrl).href, stringRecord(map)],
      ),
    ),
    baseUrl,
  };
}

/** Resolves one specifier imported by `importerUrl` to a module URL. */
export type SpecifierResolver = (
  specifier: string,
  importerUrl: string,
) => string | null;

const SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
const TYPESCRIPT_FOR_JAVASCRIPT: Readonly<Record<string, string>> = {
  ".js": ".ts",
  ".jsx": ".tsx",
  ".mjs": ".mts",
  ".cjs": ".cts",
};
const EXTENSIONS = [".ts", ".tsx", ".d.ts", ".mts", ".js"];

/**
 * Build a resolver. A relative or mapped path that points at no file
 * resolves to `null`; a specifier outside the project (a package or a remote
 * module) resolves to itself.
 */
export function createSpecifierResolver(
  importMap?: ImportMap,
): SpecifierResolver {
  return (specifier, importerUrl) => {
    const mapped =
      importMap === undefined
        ? undefined
        : applyImportMap(importMap, specifier, importerUrl);
    const target = mapped ?? specifier;
    if (isRelative(target)) {
      const base = mapped === undefined ? importerUrl : importMap!.baseUrl;
      return resolveFile(new URL(target, base));
    }
    if (SCHEME.test(target)) {
      const url = new URL(target);
      return url.protocol === "file:" ? resolveFile(url) : url.href;
    }
    return target;
  };
}

function applyImportMap(
  importMap: ImportMap,
  specifier: string,
  importerUrl: string,
): string | undefined {
  const scopes = Object.keys(importMap.scopes)
    .filter((scope) => importerUrl.startsWith(scope))
    .sort((a, b) => b.length - a.length);
  for (const scope of scopes) {
    const target = lookup(importMap.scopes[scope]!, specifier);
    if (target !== undefined) {
      return target;
    }
  }
  return lookup(importMap.imports, specifier);
}

function lookup(
  map: Readonly<Record<string, string>>,
  specifier: string,
): string | undefined {
  const exact = map[specifier];
  if (exact !== undefined) {
    return exact;
  }
  const prefixes = Object.keys(map)
    .filter((key) => key.endsWith("/") && specifier.startsWith(key))
    .sort((a, b) => b.length - a.length);
  const prefix = prefixes[0];
  if (prefix === undefined) {
    return undefined;
  }
  return map[prefix]! + specifier.slice(prefix.length);
}

function isRelative(specifier: string): boolean {
  return (
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith("/")
  );
}

/** The file URL of an existing module, trying the extensions Deno and TypeScript accept. */
function resolveFile(url: URL): string | null {
  const path = fileURLToPath(url);
  const candidates = [path];
  for (const [javascript, typescript] of Object.entries(
    TYPESCRIPT_FOR_JAVASCRIPT,
  )) {
    if (path.endsWith(javascript)) {
      candidates.push(path.slice(0, -javascript.length) + typescript);
    }
  }
  for (const extension of EXTENSIONS) {
    candidates.push(path + extension);
  }
  candidates.push(`${path}/index.ts`);
  for (const candidate of candidates) {
    if (isFile(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }
  return null;
}

function isFile(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}
