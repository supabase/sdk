/**
 * What the parser records about one TypeScript module: its imports, its
 * re-exports and the symbols it declares, with every type expressed as a
 * {@link TypeNode}. The normalizer consumes this model only, so the parser
 * can change without touching the type language.
 */

export interface SourceLocation {
  /** URL of the module, `file:` for project files. */
  filename: string;
  /** 1-based line. */
  line: number;
  /** 0-based column. */
  col: number;
}

/** One name an `import` declaration brings into the module. */
export interface ImportModel {
  /** The name the import is known by in the importing module. */
  importedName: string;
  /** The name the symbol has in the module it comes from; `*` for a namespace import, `default` for a default import. */
  originalName: string;
  /** The specifier as written, for diagnostics. */
  specifier: string;
  /** Resolved URL of the imported module: `file:` for project files, the bare `npm:`/`jsr:`/`https:` specifier otherwise, `null` when a project path could not be found. */
  src: string | null;
}

/** `export { originalName as exportedName } from "specifier"`. */
export interface ReexportModel {
  exportedName: string;
  originalName: string;
  specifier: string;
  src: string | null;
}

export type LiteralValue =
  | { kind: "string"; string: string }
  | { kind: "number"; number: number }
  | { kind: "boolean"; boolean: boolean }
  | { kind: "bigInt"; string: string }
  | { kind: "template" };

export type TypeRefResolution =
  | { kind: "local" }
  | { kind: "typeParam" }
  | { kind: "import" };

export interface TypeRefValue {
  /** The name as written, dotted for a qualified name such as `NS.Thing`. */
  typeName: string;
  typeParams?: TypeNode[] | null;
  /** Absent for a name that is neither declared, imported nor a type parameter: a global such as `Array` or `Date`. */
  resolution?: TypeRefResolution;
}

export interface TypeLiteralValue {
  properties?: PropertyDef[];
  indexSignatures?: IndexSignatureDef[];
  methods?: { name: string }[];
}

/**
 * A type expression. Every node is a `kind` tag with the payload under
 * `value` and the source text in `repr`. Kinds the normalizer does not list
 * are carried through so they can be reported as unsupported with their text.
 */
export type TypeNode =
  | { kind: "keyword"; repr?: string; value: string }
  | { kind: "literal"; repr?: string; value: LiteralValue }
  | { kind: "typeRef"; repr?: string; value: TypeRefValue }
  | { kind: "union"; repr?: string; value: TypeNode[] }
  | { kind: "intersection"; repr?: string; value: TypeNode[] }
  | { kind: "array"; repr?: string; value: TypeNode }
  | { kind: "tuple"; repr?: string; value: TypeNode[] }
  | { kind: "typeLiteral"; repr?: string; value: TypeLiteralValue }
  | { kind: "parenthesized"; repr?: string; value: TypeNode }
  | { kind: "optional"; repr?: string; value: TypeNode }
  | {
      kind: "typeOperator";
      repr?: string;
      value: { operator: string; tsType: TypeNode };
    }
  | { kind: string; repr?: string; value?: unknown };

export interface PropertyDef {
  name: string;
  optional?: boolean;
  readonly?: boolean;
  tsType?: TypeNode | null;
  location?: SourceLocation;
}

export interface IndexSignatureDef {
  params: { name?: string; tsType?: TypeNode | null }[];
  tsType?: TypeNode | null;
}

export interface TypeParamDef {
  name: string;
  default?: TypeNode | null;
}

export interface TypeAliasDef {
  tsType: TypeNode;
  typeParams?: TypeParamDef[];
}

export interface InterfaceDef extends TypeLiteralValue {
  extends?: TypeNode[];
  typeParams?: TypeParamDef[];
}

export interface EnumDef {
  members: { name: string; init?: TypeNode | null }[];
}

export type DeclarationModel =
  | {
      kind: "typeAlias";
      declarationKind: "export" | "private";
      def: TypeAliasDef;
      location: SourceLocation;
    }
  | {
      kind: "interface";
      declarationKind: "export" | "private";
      def: InterfaceDef;
      location: SourceLocation;
    }
  | {
      kind: "enum";
      declarationKind: "export" | "private";
      def: EnumDef;
      location: SourceLocation;
    }
  | {
      kind: string;
      declarationKind: "export" | "private";
      location: SourceLocation;
    };

export interface SymbolModel {
  name: string;
  declarations: DeclarationModel[];
}

/** One parsed module. */
export interface ModuleModel {
  imports?: ImportModel[];
  symbols: SymbolModel[];
  /** `export { X } from` and `export type { X as Y } from`. */
  reexports?: ReexportModel[];
  /** Resolved URLs of `export * from` targets, in source order; `null` for an unresolvable one. */
  starReexports?: { specifier: string; src: string | null }[];
  /** Syntax errors the parser recovered from, as `line:col message`. */
  parseErrors?: string[];
}

/** Where the normalizer looks modules up; a loader may parse them lazily. */
export interface ModuleSource {
  get(url: string): ModuleModel | undefined;
  has(url: string): boolean;
}
