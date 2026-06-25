import { relative } from "node:path";
import type { ParsedSymbol, ParseResult } from "./ts-parser.js";
export type { ParsedSymbol, ParseResult };

export interface SymbolGraphSymbol {
  kind: { identifier: string };
  pathComponents: string[];
  location?: { uri: string; position?: { line: number; character: number } };
}

// Kind identifiers that map to ParsedSymbol kinds.
// swift.deinit and all unrecognised kinds are skipped.
const KIND_MAP: Record<string, ParsedSymbol["kind"]> = {
  "swift.class":          "class",
  "swift.struct":         "class",
  "swift.enum":           "class",
  "swift.protocol":       "class",
  "swift.actor":          "class",
  "swift.func":           "function",
  "swift.func.op":        "function",
  "swift.method":         "method",
  "swift.type.method":    "method",
  "swift.init":           "method",
  "swift.subscript":      "method",
  "swift.type.subscript": "method",
  "swift.property":       "property",
  "swift.type.property":  "property",
  "swift.enum.case":      "property",
  "swift.typealias":      "variable",
  "swift.associatedtype": "variable",
  "swift.var":            "variable",
};

export function normalizeSymbolGraph(
  symbols: SymbolGraphSymbol[],
  sdkRoot: string,
): ParseResult {
  const result: ParsedSymbol[] = [];

  for (const sym of symbols) {
    const kind = KIND_MAP[sym.kind.identifier];
    if (kind === undefined) continue;

    const sym_: ParsedSymbol = {
      name: qualifiedName(sym.pathComponents),
      kind,
      file: resolveFile(sym.location?.uri, sdkRoot),
    };
    if (sym.location?.position !== undefined) {
      sym_.line = sym.location.position.line + 1;
    }
    result.push(sym_);
  }

  return { symbols: result };
}

function qualifiedName(pathComponents: string[]): string {
  if (pathComponents.length === 0) return "";
  const parts = pathComponents.map((part, i) => {
    if (i < pathComponents.length - 1) return part;
    const parenIdx = part.indexOf("(");
    return parenIdx >= 0 ? part.slice(0, parenIdx) : part;
  });
  return parts.join(".");
}

function resolveFile(uri: string | undefined, sdkRoot: string): string {
  if (!uri) return "";
  const path = uri.startsWith("file://") ? uri.slice(7) : uri;
  return sdkRoot ? relative(sdkRoot, path) : path;
}
