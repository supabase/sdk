import ts from "typescript";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve, relative } from "node:path";

export interface ParsedSymbol {
  name: string;  // e.g. "GoTrueClient.signUp" or "createClient"
  kind: "class" | "method" | "property" | "function" | "variable";
  file: string;  // path relative to project root
}

export interface ParseResult {
  symbols: ParsedSymbol[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set(["node_modules", "dist", "build", "out", ".git"]);
const SKIP_SUFFIXES = [".d.ts", ".test.ts", ".spec.ts", ".config.ts"];

function findSourceFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findSourceFiles(full));
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !SKIP_SUFFIXES.some((s) => entry.name.endsWith(s))
      ) {
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

    out.push({ name: `${className}.${name}`, kind, file: relPath });
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
        symbols.push({ name: className, kind: "class", file: relPath });
        extractClassMembers(className, stmt, relPath, symbols);
      }
    } else if (ts.isFunctionDeclaration(stmt) && isExported(stmt)) {
      const name = stmt.name?.text;
      if (name) symbols.push({ name, kind: "function", file: relPath });
    } else if (ts.isVariableStatement(stmt) && isExported(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          symbols.push({ name: decl.name.text, kind: "variable", file: relPath });
        }
      }
    }
  }

  return symbols;
}

export function parseTypeScriptProject(projectRoot: string): ParseResult {
  const root = resolve(projectRoot);
  const srcDir = join(root, "src");
  const scanRoot = existsSync(srcDir) ? srcDir : root;

  const files = findSourceFiles(scanRoot);
  const symbols: ParsedSymbol[] = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const relPath = relative(root, file);
    symbols.push(...extractFromSource(source, relPath));
  }

  return { symbols };
}
