import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import type { ParsedSymbol, ParseResult } from "./ts-parser.js";
import { loadIgnore, type Ignore } from "./parse-ignore.js";

export type { ParsedSymbol, ParseResult };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// Directories that are never meaningful Python source
const SKIP_DIRS = new Set([
  "__pycache__", ".git", "node_modules",
  "venv", ".venv", "env", ".env",
  "build", "dist", ".tox", ".pytest_cache", ".mypy_cache",
]);

function findPythonFiles(dir: string, root: string, ig: Ignore): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      const rel = relative(root, full);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        if (ig.ignores(rel + "/")) continue;
        results.push(...findPythonFiles(full, root, ig));
      } else if (entry.isFile() && entry.name.endsWith(".py")) {
        if (ig.ignores(rel)) continue;
        results.push(full);
      }
    }
  } catch { /* ignore unreadable dirs */ }
  return results;
}

// ---------------------------------------------------------------------------
// Single-file parser
// ---------------------------------------------------------------------------

interface Context {
  name: string;          // possibly dotted: "SupabaseClient.Config"
  classIndent: number;   // indent of the `class` keyword line itself
  memberIndent: number | null; // indent of direct class body members (set on first member)
}

// Normalise leading whitespace: tabs count as 4 spaces
function getIndent(line: string): number {
  let n = 0;
  for (const ch of line) {
    if (ch === " ") n += 1;
    else if (ch === "\t") n += 4;
    else break;
  }
  return n;
}

// Dunder names like __init__, __repr__ are implementation details, not API surface
const DUNDER_RE = /^__\w+__$/;

export function extractFromSource(source: string, relPath: string): ParsedSymbol[] {
  const symbols: ParsedSymbol[] = [];
  const contextStack: Context[] = [];
  const pendingDecorators: string[] = [];

  for (const rawLine of source.split("\n")) {
    // Strip inline # comments — simplified (doesn't handle # inside strings, which
    // is acceptable for the SDK codebases this parser targets)
    const commentIdx = rawLine.indexOf("#");
    const line = commentIdx >= 0 ? rawLine.slice(0, commentIdx) : rawLine;
    const trimmed = line.trim();

    if (!trimmed) continue;

    const indent = getIndent(rawLine);

    // Pop contexts that have ended: we're at or before the class indent level
    while (
      contextStack.length > 0 &&
      indent <= contextStack[contextStack.length - 1].classIndent
    ) {
      contextStack.pop();
    }

    // Collect decorator names without arguments: "@property" → "property",
    // "@name.setter" → "name.setter"
    if (trimmed.startsWith("@")) {
      pendingDecorators.push(trimmed.slice(1).split("(")[0].trim());
      continue;
    }

    const topCtx = contextStack.length > 0 ? contextStack[contextStack.length - 1] : null;

    // Determine whether this line sits at the valid direct-member indent for the
    // current class context. The member indent is discovered lazily from the first
    // declaration line seen inside the class body.
    let atMemberLevel: boolean;
    if (topCtx === null) {
      atMemberLevel = indent === 0;
    } else if (topCtx.memberIndent === null) {
      topCtx.memberIndent = indent; // first declaration — establish the body indent
      atMemberLevel = true;
    } else {
      atMemberLevel = indent === topCtx.memberIndent;
    }

    const decorators = [...pendingDecorators];
    pendingDecorators.length = 0;

    if (!atMemberLevel) continue;

    const currentName = topCtx ? topCtx.name : "";

    // --- Class declaration ---
    const classMatch = trimmed.match(/^class\s+(\w+)/);
    if (classMatch) {
      const className = classMatch[1];
      if (!className.startsWith("_")) {
        const qualifiedName = currentName ? `${currentName}.${className}` : className;
        symbols.push({ name: qualifiedName, kind: "class", file: relPath });
        contextStack.push({ name: qualifiedName, classIndent: indent, memberIndent: null });
      }
      continue;
    }

    // --- Function / method declaration ---
    const funcMatch = trimmed.match(/^(?:async\s+)?def\s+(\w+)/);
    if (funcMatch) {
      const funcName = funcMatch[1];
      // Skip private names (leading _) and dunder methods (__x__)
      if (funcName.startsWith("_") || DUNDER_RE.test(funcName)) continue;

      // Skip property setters/deleters — their decorator ends with .setter / .deleter
      const isAccessor = decorators.some((d) => /\.\w+$/.test(d));
      if (isAccessor) continue;

      if (currentName) {
        const isProperty = decorators.includes("property");
        symbols.push({
          name: `${currentName}.${funcName}`,
          kind: isProperty ? "property" : "method",
          file: relPath,
        });
      } else {
        symbols.push({ name: funcName, kind: "function", file: relPath });
      }
      continue;
    }
  }

  return symbols;
}

// ---------------------------------------------------------------------------
// Project-level entry point
// ---------------------------------------------------------------------------

export function parsePythonProject(projectRoot: string): ParseResult {
  const root = resolve(projectRoot);
  const ig = loadIgnore(root);
  // Support both src-layout (src/packagename/) and flat layout (packagename/)
  const srcDir = join(root, "src");
  const scanRoot = existsSync(srcDir) ? srcDir : root;

  const files = findPythonFiles(scanRoot, root, ig);
  const symbols: ParsedSymbol[] = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const relPath = relative(root, file);
    symbols.push(...extractFromSource(source, relPath));
  }

  return { symbols };
}
