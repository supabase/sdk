import { basename, relative } from "node:path";
import type { ParsedSymbol, ParseResult } from "./ts-parser.js";
import { loadIgnore, type Ignore } from "./parse-ignore.js";

export type { ParsedSymbol, ParseResult };

export interface GriffeNode {
  kind: "module" | "class" | "function" | "attribute";
  filepath?: string;
  labels?: string[] | null;
  members?: Record<string, GriffeNode>;
  lineno?: number;
}

export type GriffeOutput = Record<string, GriffeNode>;

export function normalizeGriffe(raw: GriffeOutput, projectRoot = ""): ParseResult {
  const ig = projectRoot ? loadIgnore(projectRoot) : null;
  const symbols: ParsedSymbol[] = [];

  for (const [, moduleNode] of Object.entries(raw)) {
    walkNode("", moduleNode, "", [], symbols, ig, projectRoot);
  }

  return { symbols };
}

function walkNode(
  name: string,
  node: GriffeNode,
  inheritedFile: string,
  classStack: string[],
  symbols: ParsedSymbol[],
  ig: Ignore | null,
  projectRoot: string,
): void {
  const file = node.filepath
    ? (projectRoot ? relative(projectRoot, node.filepath) : basename(node.filepath))
    : inheritedFile;

  if (node.kind === "module") {
    for (const [childName, child] of Object.entries(node.members ?? {})) {
      walkNode(childName, child, file, classStack, symbols, ig, projectRoot);
    }
    return;
  }

  if (name.startsWith("_")) return;

  if (node.kind === "class") {
    emit(symbols, ig, { name: qual(classStack, name), kind: "class", file }, node.lineno);
    for (const [childName, child] of Object.entries(node.members ?? {})) {
      walkNode(childName, child, file, [...classStack, name], symbols, ig, projectRoot);
    }
    return;
  }

  if (node.kind === "function") {
    const kind = classStack.length > 0 ? ("method" as const) : ("function" as const);
    emit(symbols, ig, { name: qual(classStack, name), kind, file }, node.lineno);
    return;
  }

  if (node.kind === "attribute" && node.labels?.includes("property")) {
    emit(symbols, ig, { name: qual(classStack, name), kind: "property", file }, node.lineno);
  }
}

function qual(classStack: string[], name: string): string {
  return classStack.length > 0 ? `${classStack.join(".")}.${name}` : name;
}

function emit(symbols: ParsedSymbol[], ig: Ignore | null, sym: ParsedSymbol, lineno?: number): void {
  if (ig && sym.file && ig.ignores(sym.file)) return;
  // Griffe inherits Python ast.lineno which is already 1-based — no +1 needed (unlike TS/Swift).
  symbols.push(lineno !== undefined ? { ...sym, line: lineno } : sym);
}
