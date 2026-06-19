import { relative } from "node:path";
import type { ParsedSymbol, ParseResult } from "./ts-parser.js";
export type { ParsedSymbol, ParseResult };

export interface SymbolGraphSymbol {
  kind: { identifier: string };
  accessLevel: string;
  pathComponents: string[];
  location?: { uri: string };
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
  // TODO: implement in Task 2
  return { symbols: [] };
}
