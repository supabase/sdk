/**
 * The subset of the `deno doc --json` output (document version 2) this
 * package reads. Deno documents the shape only through its own source, so the
 * fields are typed here as they are consumed; anything else on a node is
 * ignored. Every type node is a `kind` tag with the payload under `value`, and
 * most carry the source text in `repr`.
 */

export interface DocLocation {
  filename: string;
  line: number;
  col: number;
}

/** One import of a documented module, resolved to the module it came from. */
export interface DocImport {
  /** The name the import is known by in the importing module. */
  importedName: string;
  /** The name the symbol has in the module it comes from (`*` for namespaces). */
  originalName: string;
  /** Resolved URL of the imported module (`file://`, `npm:`, `jsr:`, `https://`). */
  src: string;
}

export type LiteralValue =
  | { kind: "string"; string: string }
  | { kind: "number"; number: number }
  | { kind: "boolean"; boolean: boolean }
  | { kind: "bigInt"; string: string }
  | { kind: "template"; tsTypes: TsType[] };

export type TypeRefResolution =
  | { kind: "local" }
  | { kind: "typeParam"; declaringName: string; declaringKind: string }
  | { kind: "import"; specifier: string; name: string }
  | { kind: string };

export interface TypeRefValue {
  typeName: string;
  typeParams?: TsType[] | null;
  resolution?: TypeRefResolution;
}

export interface TypeLiteralValue {
  properties?: PropertyDef[];
  indexSignatures?: IndexSignatureDef[];
  methods?: { name: string }[];
}

export type TsType =
  | { kind: "keyword"; repr?: string; value: string }
  | { kind: "literal"; repr?: string; value: LiteralValue }
  | { kind: "typeRef"; repr?: string; value: TypeRefValue }
  | { kind: "union"; repr?: string; value: TsType[] }
  | { kind: "intersection"; repr?: string; value: TsType[] }
  | { kind: "array"; repr?: string; value: TsType }
  | { kind: "tuple"; repr?: string; value: TsType[] }
  | { kind: "typeLiteral"; repr?: string; value: TypeLiteralValue }
  | { kind: "parenthesized"; repr?: string; value: TsType }
  | { kind: "optional"; repr?: string; value: TsType }
  | {
      kind: "typeOperator";
      repr?: string;
      value: { operator: string; tsType: TsType };
    }
  | { kind: string; repr?: string; value?: unknown };

export interface PropertyDef {
  name: string;
  optional?: boolean;
  readonly?: boolean;
  tsType?: TsType | null;
  location?: DocLocation;
}

export interface IndexSignatureDef {
  params: { name?: string; tsType?: TsType | null }[];
  tsType?: TsType | null;
}

export interface TypeParamDef {
  name: string;
  default?: TsType | null;
}

export interface TypeAliasDef {
  tsType: TsType;
  typeParams?: TypeParamDef[];
}

export interface InterfaceDef extends TypeLiteralValue {
  extends?: TsType[];
  typeParams?: TypeParamDef[];
}

export interface EnumDef {
  members: { name: string; init?: TsType | null }[];
}

export type DocDeclaration =
  | {
      kind: "typeAlias";
      declarationKind: string;
      def: TypeAliasDef;
      location: DocLocation;
    }
  | {
      kind: "interface";
      declarationKind: string;
      def: InterfaceDef;
      location: DocLocation;
    }
  | {
      kind: "enum";
      declarationKind: string;
      def: EnumDef;
      location: DocLocation;
    }
  | { kind: string; declarationKind: string; location: DocLocation };

export interface DocSymbol {
  name: string;
  declarations: DocDeclaration[];
}

/** One documented module: its imports and the symbols it declares. */
export interface DocModule {
  imports?: DocImport[];
  symbols: DocSymbol[];
}

/** The whole `deno doc --json` document, keyed by module URL. */
export interface DocOutput {
  version: number;
  nodes: Record<string, DocModule>;
}
