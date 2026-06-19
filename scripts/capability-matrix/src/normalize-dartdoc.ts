import type { ParseResult } from "./ts-parser.js";
export type { ParseResult };
export type { ParsedSymbol } from "./ts-parser.js";

export interface DartdocMember {
  kind: string;
  name: string;
  static?: boolean;
}

export interface DartdocDeclaration {
  kind: string;
  name: string;
  members?: DartdocMember[];
  values?: Array<{ name: string }>;
}

export interface DartdocUnit {
  source: string;
  declarations: DartdocDeclaration[];
}

export function normalizeDartdoc(_units: DartdocUnit[]): ParseResult {
  throw new Error("not implemented");
}
