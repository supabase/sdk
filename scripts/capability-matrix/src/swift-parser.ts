import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import type { ParsedSymbol, ParseResult } from "./ts-parser.js";

export type { ParsedSymbol, ParseResult };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set([
  ".build", "DerivedData", ".git", "Examples", "example", "docs",
]);
// Directories whose content is test code — skip entirely
const TEST_DIRS = new Set(["Tests", "TestHelpers", "XCTestCase"]);

function findSwiftFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
      if (TEST_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findSwiftFiles(full));
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".swift") &&
        !entry.name.endsWith("Tests.swift") &&
        !entry.name.includes("Test.")
      ) {
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
  name: string;   // possibly dotted: "AuthClient.Configuration"
  depth: number;  // brace depth after entering this context
}

// Access modifiers that indicate a symbol is public API
const ACCESS_PATTERN = /\b(?:public|open)\b/;
// Declaration keywords for types
const TYPE_KW = /\b(class|struct|enum|actor|protocol)\b/;
// Declaration keyword for extensions
const EXT_KW = /\bextension\b/;

export function extractFromSource(source: string, relPath: string): ParsedSymbol[] {
  const symbols: ParsedSymbol[] = [];
  const contextStack: Context[] = [];
  let depth = 0;

  for (const rawLine of source.split("\n")) {
    // Strip line comments (// and ///) – handles the most common case
    const commentIdx = rawLine.indexOf("//");
    const line = commentIdx >= 0 ? rawLine.slice(0, commentIdx) : rawLine;
    const trimmed = line.trim();

    if (!trimmed) continue;
    // Preprocessor directives don't affect declarations
    if (trimmed.startsWith("#")) continue;

    const opens = countChar(line, "{");
    const closes = countChar(line, "}");
    const isPublic = ACCESS_PATTERN.test(trimmed);
    const isTypeDecl = isPublic && TYPE_KW.test(trimmed);
    const isExtDecl = EXT_KW.test(trimmed);

    const currentType =
      contextStack.length > 0 ? contextStack[contextStack.length - 1].name : "";

    // --- Emit symbols for declarations on this line ---

    if (isTypeDecl) {
      const m = trimmed.match(/\b(class|struct|enum|actor|protocol)\b\s+(\w+)/);
      if (m) {
        const typeName = m[2];
        const qualifiedName = currentType ? `${currentType}.${typeName}` : typeName;
        symbols.push({ name: qualifiedName, kind: "class", file: relPath });
      }
    } else if (isPublic && currentType) {
      // Inside a type context: emit public members
      const funcM = trimmed.match(/\bfunc\b\s+(\w+)/);
      const varM = !funcM && trimmed.match(/\b(?:var|let)\b\s+(\w+)/);
      const typealiasM = !funcM && !varM && trimmed.match(/\btypealias\b\s+(\w+)/);
      const isInit = !funcM && !varM && !typealiasM && /\binit\b/.test(trimmed);

      if (funcM) {
        symbols.push({ name: `${currentType}.${funcM[1]}`, kind: "method", file: relPath });
      } else if (varM) {
        symbols.push({ name: `${currentType}.${varM[1]}`, kind: "property", file: relPath });
      } else if (typealiasM) {
        symbols.push({ name: `${currentType}.${typealiasM[1]}`, kind: "variable", file: relPath });
      } else if (isInit) {
        symbols.push({ name: `${currentType}.init`, kind: "method", file: relPath });
      }
    } else if (isPublic && !currentType) {
      // Top-level public declarations
      const funcM = trimmed.match(/\bfunc\b\s+(\w+)/);
      const typealiasM = !funcM && trimmed.match(/\btypealias\b\s+(\w+)/);
      if (funcM) {
        symbols.push({ name: funcM[1], kind: "function", file: relPath });
      } else if (typealiasM) {
        symbols.push({ name: typealiasM[1], kind: "variable", file: relPath });
      }
    }

    // --- Update depth ---
    depth += opens - closes;

    // Pop contexts that ended when closes brought depth below their enter depth
    while (
      contextStack.length > 0 &&
      contextStack[contextStack.length - 1].depth > depth
    ) {
      contextStack.pop();
    }

    // Push new context if this line opens a type or extension body
    if (opens > closes) {
      if (isTypeDecl) {
        const m = trimmed.match(/\b(class|struct|enum|actor|protocol)\b\s+(\w+)/);
        if (m) {
          const typeName = m[2];
          const qualifiedName = currentType ? `${currentType}.${typeName}` : typeName;
          contextStack.push({ name: qualifiedName, depth });
        }
      } else if (isExtDecl) {
        // Extensions can extend dotted names: "extension AuthClient.Configuration"
        const m = trimmed.match(/\bextension\b\s+([\w.]+)/);
        if (m) contextStack.push({ name: m[1], depth });
      }
    }
  }

  return symbols;
}

// ---------------------------------------------------------------------------
// Project-level entry point
// ---------------------------------------------------------------------------

export function parseSwiftProject(projectRoot: string): ParseResult {
  const root = resolve(projectRoot);
  // SPM convention: Sources/ holds all public library targets
  const srcDir = join(root, "Sources");
  const scanRoot = existsSync(srcDir) ? srcDir : root;

  const files = findSwiftFiles(scanRoot);
  const symbols: ParsedSymbol[] = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const relPath = relative(root, file);
    symbols.push(...extractFromSource(source, relPath));
  }

  return { symbols };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function countChar(s: string, ch: string): number {
  let count = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === ch) count++;
  }
  return count;
}
