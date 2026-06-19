export interface ParsedSymbol {
  name: string;
  kind: "class" | "method" | "property" | "function" | "variable";
  file: string;
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
  sources?: Array<{ fileName: string }>;
  children?: TdReflection[];
}

function fileOf(r: TdReflection): string {
  return r.sources?.[0]?.fileName ?? "";
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
    const file = fileOf(child);
    if (child.kind === Kind.Method) {
      out.push({ name: qualName, kind: "method", file });
    } else if (child.kind === Kind.Property) {
      out.push({ name: qualName, kind: "property", file });
    } else if (child.kind === Kind.Accessor) {
      out.push({ name: qualName, kind: "method", file });
    } else if (child.kind === Kind.EnumMember) {
      out.push({ name: qualName, kind: "property", file });
    }
  }
}

function extractDeclarations(
  children: TdReflection[],
  out: ParsedSymbol[],
): void {
  for (const child of children) {
    if (isExcluded(child)) continue;
    const file = fileOf(child);
    if (child.kind === Kind.Module || child.kind === Kind.Namespace) {
      if (child.children) extractDeclarations(child.children, out);
    } else if (child.kind === Kind.Reference) {
      continue;
    } else if (
      child.kind === Kind.Class ||
      child.kind === Kind.Interface ||
      child.kind === Kind.Enum
    ) {
      out.push({ name: child.name, kind: "class", file });
      if (child.children) extractMembers(child.name, child.children, out);
    } else if (child.kind === Kind.Function) {
      out.push({ name: child.name, kind: "function", file });
    } else if (child.kind === Kind.Variable || child.kind === Kind.TypeAlias) {
      out.push({ name: child.name, kind: "variable", file });
    }
  }
}

export function normalize(json: unknown): ParseResult {
  const project = json as TdReflection;
  const symbols: ParsedSymbol[] = [];
  if (project.children) extractDeclarations(project.children, symbols);
  return { symbols };
}
