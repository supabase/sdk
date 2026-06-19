import type { ParsedSymbol, ParseResult } from "./ts-parser.js";
export type { ParsedSymbol, ParseResult };

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

// Class-like top-level kinds that also have processable members.
// Note: "extension_type" is intentionally absent — dartdoc_json 0.5.0 throws
// AssertionError("Unknown declaration type: ExtensionTypeDeclarationImpl") when
// it encounters an extension type declaration, so that kind never appears in output.
// supabase-flutter does not use extension types in its public API surface.
const CLASS_LIKE = new Set(["class", "mixin", "enum", "extension"]);

export function normalizeDartdoc(units: DartdocUnit[]): ParseResult {
  const symbols: ParsedSymbol[] = [];

  for (const unit of units) {
    for (const decl of unit.declarations) {
      if (decl.name.startsWith("_")) continue;

      const topKind = resolveTopKind(decl.kind);
      if (topKind !== null) {
        symbols.push({ name: decl.name, kind: topKind, file: unit.source });
      }

      if (CLASS_LIKE.has(decl.kind) && decl.members) {
        for (const member of decl.members) {
          const simpleName = memberSimpleName(member);
          if (simpleName.startsWith("_")) continue;
          symbols.push({
            name: `${decl.name}.${simpleName}`,
            kind: resolveMemberKind(member.kind),
            file: unit.source,
          });
        }
      }
    }
  }

  return { symbols };
}

function resolveTopKind(kind: string): ParsedSymbol["kind"] | null {
  switch (kind) {
    case "class":
    case "mixin":
    case "enum":
    case "extension":
      // "extension_type" is not handled: dartdoc_json 0.5.0 cannot parse extension types
      // (throws AssertionError) so that kind never appears in its output.
      return "class";
    case "function":
      return "function";
    case "typedef":
    case "variable":
      return "variable";
    default:
      return null;
  }
}

function resolveMemberKind(kind: string): ParsedSymbol["kind"] {
  switch (kind) {
    case "getter":
    case "setter":
    case "field":
      return "property";
    default:
      return "method";
  }
}

// For constructors dartdoc_json uses:
//   default:  name = "ClassName"          → emit "ClassName.ClassName"
//   named:    name = "ClassName.ctorName" → emit "ClassName.ctorName"
// Extracting the last segment with split(".").pop() handles both cases uniformly:
//   "SupabaseClient".split(".").pop()           = "SupabaseClient" → "SupabaseClient.SupabaseClient"
//   "SupabaseClient.withConfig".split(".").pop() = "withConfig"    → "SupabaseClient.withConfig"
function memberSimpleName(member: DartdocMember): string {
  if (member.kind === "constructor") {
    return member.name.split(".").pop()!;
  }
  return member.name;
}
