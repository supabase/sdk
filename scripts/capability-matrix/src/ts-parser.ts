import ts from "typescript";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { loadIgnore, type Ignore } from "./parse-ignore.js";

export interface ParsedSymbol {
  name: string;
  kind: "class" | "method" | "property" | "function" | "variable";
  file: string;
  line?: number;
}

export interface ParseResult {
  symbols: ParsedSymbol[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function findSourceFiles(dir: string, root: string, ig: Ignore): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      const rel = relative(root, full);
      if (entry.isDirectory()) {
        if (ig.ignores(rel + "/")) continue;
        results.push(...findSourceFiles(full, root, ig));
      } else if (entry.isFile() && entry.name.endsWith(".ts")) {
        if (ig.ignores(rel)) continue;
        results.push(full);
      }
    }
  } catch { /* ignore unreadable dirs */ }
  return results;
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const mods = ts.getModifiers(node);
  return mods?.some((m) => m.kind === kind) ?? false;
}

function isExported(node: ts.Node): boolean {
  return hasModifier(node, ts.SyntaxKind.ExportKeyword);
}

function isPublicMember(member: ts.ClassElement): boolean {
  if (member.name?.kind === ts.SyntaxKind.PrivateIdentifier) return false;
  if (hasModifier(member, ts.SyntaxKind.PrivateKeyword)) return false;
  if (hasModifier(member, ts.SyntaxKind.ProtectedKeyword)) return false;
  return true;
}

function memberIdentifierName(member: ts.ClassElement): string | undefined {
  const n = member.name;
  if (!n) return undefined;
  if (ts.isIdentifier(n)) return n.text;
  if (ts.isStringLiteral(n)) return n.text;
  return undefined;
}

function extractClassMembers(
  className: string,
  node: ts.ClassDeclaration,
  relPath: string,
  sf: ts.SourceFile,
  out: ParsedSymbol[],
): void {
  for (const member of node.members) {
    if (ts.isConstructorDeclaration(member)) continue;
    if (!isPublicMember(member)) continue;

    const name = memberIdentifierName(member);
    if (!name) continue;

    const kind =
      ts.isMethodDeclaration(member) ||
      ts.isGetAccessorDeclaration(member) ||
      ts.isSetAccessorDeclaration(member)
        ? "method"
        : "property";

    const line = sf.getLineAndCharacterOfPosition(member.getStart(sf)).line + 1;
    out.push({ name: `${className}.${name}`, kind, file: relPath, line });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function extractFromSource(
  source: string,
  relPath: string,
): ParsedSymbol[] {
  const sf = ts.createSourceFile(relPath, source, ts.ScriptTarget.Latest, true);
  const symbols: ParsedSymbol[] = [];

  for (const stmt of sf.statements) {
    if (ts.isClassDeclaration(stmt) && isExported(stmt)) {
      const className = stmt.name?.text;
      if (className) {
        const line = sf.getLineAndCharacterOfPosition(stmt.getStart(sf)).line + 1;
        symbols.push({ name: className, kind: "class", file: relPath, line });
        extractClassMembers(className, stmt, relPath, sf, symbols);
      }
    } else if (ts.isFunctionDeclaration(stmt) && isExported(stmt)) {
      const name = stmt.name?.text;
      if (name) {
        const line = sf.getLineAndCharacterOfPosition(stmt.getStart(sf)).line + 1;
        symbols.push({ name, kind: "function", file: relPath, line });
      }
    } else if (ts.isVariableStatement(stmt) && isExported(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          const line = sf.getLineAndCharacterOfPosition(decl.getStart(sf)).line + 1;
          symbols.push({ name: decl.name.text, kind: "variable", file: relPath, line });
        }
      }
    }
  }

  return symbols;
}

export function parseTypeScriptProject(projectRoot: string): ParseResult {
  const root = resolve(projectRoot);
  const ig = loadIgnore(root);
  const srcDir = join(root, "src");
  const scanRoot = existsSync(srcDir) ? srcDir : root;

  const files = findSourceFiles(scanRoot, root, ig);
  const symbols: ParsedSymbol[] = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const relPath = relative(root, file);
    symbols.push(...extractFromSource(source, relPath));
  }

  return { symbols };
}
