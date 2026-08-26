export interface ParsedSymbol {
  name: string;
  kind: "class" | "method" | "property" | "function" | "variable";
  file: string;
  line?: number;
}

export interface ParseResult {
  symbols: ParsedSymbol[];
}

const Kind = {
  Module: 2,
  Namespace: 4,
  Enum: 8,
  EnumMember: 16,
  Variable: 32,
  Function: 64,
  Class: 128,
  Interface: 256,
  Constructor: 512,
  Property: 1024,
  Method: 2048,
  Accessor: 262144,
  TypeAlias: 2097152,
  Reference: 4194304,
} as const;

interface TdReflection {
  name: string;
  kind: number;
  flags?: { isPrivate?: boolean; isProtected?: boolean };
  sources?: Array<{ fileName: string; line?: number }>;
  children?: TdReflection[];
}

function sourceOf(r: TdReflection): { file: string; line?: number } {
  const src = r.sources?.[0];
  return { file: src?.fileName ?? "", line: src?.line };
}

function isExcluded(r: TdReflection): boolean {
  return !!(r.flags?.isPrivate || r.flags?.isProtected);
}

function extractMembers(
  parent: string,
  children: TdReflection[],
  out: ParsedSymbol[],
): void {
  for (const child of children) {
    if (isExcluded(child)) continue;
    if (child.kind === Kind.Constructor) continue;
    const qualName = `${parent}.${child.name}`;
    const { file, line } = sourceOf(child);
    if (child.kind === Kind.Method) {
      out.push({ name: qualName, kind: "method", file, line });
    } else if (child.kind === Kind.Property) {
      out.push({ name: qualName, kind: "property", file, line });
    } else if (child.kind === Kind.Accessor) {
      out.push({ name: qualName, kind: "method", file, line });
    } else if (child.kind === Kind.EnumMember) {
      out.push({ name: qualName, kind: "property", file, line });
    }
  }
}

function extractDeclarations(
  children: TdReflection[],
  out: ParsedSymbol[],
): void {
  for (const child of children) {
    if (isExcluded(child)) continue;
    const { file, line } = sourceOf(child);
    if (child.kind === Kind.Module || child.kind === Kind.Namespace) {
      if (child.children) extractDeclarations(child.children, out);
    } else if (child.kind === Kind.Reference) {
      continue;
    } else if (
      child.kind === Kind.Class ||
      child.kind === Kind.Interface ||
      child.kind === Kind.Enum
    ) {
      out.push({ name: child.name, kind: "class", file, line });
      if (child.children) extractMembers(child.name, child.children, out);
    } else if (child.kind === Kind.Function) {
      out.push({ name: child.name, kind: "function", file, line });
    } else if (child.kind === Kind.Variable || child.kind === Kind.TypeAlias) {
      out.push({ name: child.name, kind: "variable", file, line });
    }
  }
}

export function normalize(json: unknown): ParseResult {
  const project = json as TdReflection;
  const symbols: ParsedSymbol[] = [];
  if (project.children) extractDeclarations(project.children, symbols);
  return { symbols };
}

/**
 * Normalize one or more TypeDoc project JSONs into a single `ParseResult` by
 * concatenating their symbols. Used for monorepos where each package is
 * documented separately. TypeDoc already emits repo-root-relative `fileName`s,
 * so no path rewriting is needed. Symbol names are kept as-is (the API-check
 * diff is name-based), so this is a plain concatenation — no cross-package
 * deduping; duplicate re-exports are collapsed by name downstream.
 */
export function mergeProjects(projects: unknown[]): ParseResult {
  const symbols: ParsedSymbol[] = [];
  for (const json of projects) symbols.push(...normalize(json).symbols);
  return { symbols };
}
