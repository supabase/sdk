/**
 * Reads one TypeScript module with `@babel/parser` into the
 * {@link ModuleModel} the normalizer consumes. A parser, not a type checker:
 * it records what the source says, resolves names to the declaration,
 * import or type parameter they refer to inside this module, and leaves
 * everything else (type queries, conditional types, derived types) as nodes
 * the normalizer reports as unsupported.
 */
import { parse } from "@babel/parser";
import type * as t from "@babel/types";

import type {
  DeclarationModel,
  EnumDef,
  ImportModel,
  IndexSignatureDef,
  InterfaceDef,
  LiteralValue,
  ModuleModel,
  PropertyDef,
  ReexportModel,
  SourceLocation,
  SymbolModel,
  TypeLiteralValue,
  TypeNode,
  TypeParamDef,
  TypeRefValue,
} from "./module-model.ts";
import type { SpecifierResolver } from "./resolve.ts";

export interface ParseModuleOptions {
  /** URL of the module, used in locations and to resolve relative imports. */
  readonly url: string;
  readonly source: string;
  readonly resolve: SpecifierResolver;
}

const KEYWORDS: Readonly<Record<string, string>> = {
  TSStringKeyword: "string",
  TSNumberKeyword: "number",
  TSBooleanKeyword: "boolean",
  TSNullKeyword: "null",
  TSUndefinedKeyword: "undefined",
  TSAnyKeyword: "any",
  TSUnknownKeyword: "unknown",
  TSObjectKeyword: "object",
  TSVoidKeyword: "void",
  TSNeverKeyword: "never",
  TSSymbolKeyword: "symbol",
  TSBigIntKeyword: "bigint",
  TSIntrinsicKeyword: "intrinsic",
  TSThisType: "this",
};

/** Kinds the normalizer names in its diagnostics; the rest fall back to the Babel node type. */
const OTHER_KINDS: Readonly<Record<string, string>> = {
  TSIndexedAccessType: "indexedAccess",
  TSTypeQuery: "typeQuery",
  TSConditionalType: "conditional",
  TSMappedType: "mapped",
  TSFunctionType: "fnOrConstructor",
  TSConstructorType: "fnOrConstructor",
  TSInferType: "infer",
  TSImportType: "importType",
  TSTypePredicate: "typePredicate",
  TSRestType: "rest",
};

/** Parse one module. Never throws on a syntax error; recovered errors land in `parseErrors`. */
export function parseModule(options: ParseModuleOptions): ModuleModel {
  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(options.source, {
      sourceType: "module",
      plugins: ["typescript"],
      errorRecovery: true,
    });
  } catch (error) {
    return { imports: [], symbols: [], parseErrors: [formatError(error)] };
  }
  const context = new ModuleContext(options);
  for (const statement of ast.program.body) {
    context.collectNames(statement);
  }
  for (const statement of ast.program.body) {
    context.collect(statement);
  }
  return context.finish(ast.errors.map((error) => formatError(error)));
}

type Scope = ReadonlySet<string>;
const NO_TYPE_PARAMS: Scope = new Set();

class ModuleContext {
  private readonly symbols = new Map<string, SymbolModel>();
  private readonly imports: ImportModel[] = [];
  private readonly importedNames = new Set<string>();
  private readonly declaredNames = new Set<string>();
  private readonly reexports: ReexportModel[] = [];
  private readonly starReexports: { specifier: string; src: string | null }[] =
    [];
  private readonly exportedAs: {
    exported: string;
    local: string;
    node: t.Node;
  }[] = [];

  private readonly options: ParseModuleOptions;

  constructor(options: ParseModuleOptions) {
    this.options = options;
  }

  /** First pass: every name declared or imported, so type references can be resolved. */
  collectNames(statement: t.Statement): void {
    if (statement.type === "ImportDeclaration") {
      for (const specifier of statement.specifiers) {
        this.importedNames.add(specifier.local.name);
      }
      return;
    }
    const declaration =
      statement.type === "ExportNamedDeclaration"
        ? statement.declaration
        : statement;
    if (declaration === null || declaration === undefined) {
      return;
    }
    for (const name of declaredNames(declaration)) {
      this.declaredNames.add(name);
    }
  }

  collect(statement: t.Statement): void {
    switch (statement.type) {
      case "ImportDeclaration":
        this.collectImport(statement);
        return;
      case "ExportAllDeclaration":
        this.starReexports.push({
          specifier: statement.source.value,
          src: this.resolve(statement.source.value),
        });
        return;
      case "ExportNamedDeclaration":
        if (statement.declaration) {
          this.collectDeclaration(statement.declaration, "export");
        } else if (statement.source) {
          for (const specifier of statement.specifiers) {
            if (specifier.type === "ExportSpecifier") {
              this.reexports.push({
                exportedName: moduleExportName(specifier.exported),
                originalName: moduleExportName(specifier.local),
                specifier: statement.source.value,
                src: this.resolve(statement.source.value),
              });
            }
          }
        } else {
          for (const specifier of statement.specifiers) {
            if (specifier.type === "ExportSpecifier") {
              this.exportedAs.push({
                exported: moduleExportName(specifier.exported),
                local: moduleExportName(specifier.local),
                node: specifier,
              });
            }
          }
        }
        return;
      case "ExportDefaultDeclaration":
        this.addSymbol("default", {
          kind: "variable",
          declarationKind: "export",
          location: this.location(statement),
        });
        return;
      default:
        if (isDeclaration(statement)) {
          this.collectDeclaration(statement, "private");
        }
    }
  }

  finish(parseErrors: string[]): ModuleModel {
    for (const { exported, local, node } of this.exportedAs) {
      const symbol = this.symbols.get(local);
      const imported =
        symbol === undefined
          ? this.imports.find((candidate) => candidate.importedName === local)
          : undefined;
      if (imported !== undefined) {
        if (imported.originalName !== "*") {
          this.reexports.push({
            exportedName: exported,
            originalName: imported.originalName,
            specifier: imported.specifier,
            src: imported.src,
          });
        }
        continue;
      }
      if (exported === local) {
        for (const declaration of symbol?.declarations ?? []) {
          declaration.declarationKind = "export";
        }
        continue;
      }
      this.addSymbol(exported, {
        kind: "typeAlias",
        declarationKind: "export",
        def: {
          tsType: {
            kind: "typeRef",
            repr: local,
            value: { typeName: local, resolution: { kind: "local" } },
          },
        },
        location: this.location(node),
      });
    }
    const model: ModuleModel = {
      imports: this.imports,
      symbols: [...this.symbols.values()],
      reexports: this.reexports,
      starReexports: this.starReexports,
    };
    return parseErrors.length > 0 ? { ...model, parseErrors } : model;
  }

  private collectImport(statement: t.ImportDeclaration): void {
    const src = this.resolve(statement.source.value);
    for (const specifier of statement.specifiers) {
      const originalName =
        specifier.type === "ImportSpecifier"
          ? moduleExportName(specifier.imported)
          : specifier.type === "ImportDefaultSpecifier"
            ? "default"
            : "*";
      this.imports.push({
        importedName: specifier.local.name,
        originalName,
        specifier: statement.source.value,
        src,
      });
    }
  }

  private collectDeclaration(
    declaration: t.Declaration,
    declarationKind: "export" | "private",
  ): void {
    const location = this.location(declaration);
    switch (declaration.type) {
      case "TSTypeAliasDeclaration": {
        const typeParams = this.typeParams(declaration.typeParameters);
        this.addSymbol(declaration.id.name, {
          kind: "typeAlias",
          declarationKind,
          def: {
            tsType: this.type(
              declaration.typeAnnotation,
              paramScope(typeParams),
            ),
            ...(typeParams.length > 0 ? { typeParams } : {}),
          },
          location,
        });
        return;
      }
      case "TSInterfaceDeclaration": {
        const typeParams = this.typeParams(declaration.typeParameters);
        const scope = paramScope(typeParams);
        const def: InterfaceDef = {
          ...this.members(declaration.body.body, scope),
          ...(typeParams.length > 0 ? { typeParams } : {}),
          ...(declaration.extends && declaration.extends.length > 0
            ? {
                extends: declaration.extends.map((heritage) =>
                  this.heritage(heritage, scope),
                ),
              }
            : {}),
        };
        this.addSymbol(declaration.id.name, {
          kind: "interface",
          declarationKind,
          def,
          location,
        });
        return;
      }
      case "TSEnumDeclaration":
        this.addSymbol(declaration.id.name, {
          kind: "enum",
          declarationKind,
          def: this.enumDef(declaration),
          location,
        });
        return;
      default:
        for (const name of declaredNames(declaration)) {
          this.addSymbol(name, {
            kind: kindOf(declaration),
            declarationKind,
            location,
          });
        }
    }
  }

  private addSymbol(name: string, declaration: DeclarationModel): void {
    const existing = this.symbols.get(name);
    if (existing) {
      existing.declarations.push(declaration);
    } else {
      this.symbols.set(name, { name, declarations: [declaration] });
    }
  }

  private typeParams(
    parameters: t.TSTypeParameterDeclaration | null | undefined,
  ): TypeParamDef[] {
    if (!parameters) {
      return [];
    }
    const names = new Set<string>();
    const result: TypeParamDef[] = [];
    for (const parameter of parameters.params) {
      names.add(parameter.name.name);
      result.push({
        name: parameter.name.name,
        ...(parameter.default
          ? { default: this.type(parameter.default, names) }
          : {}),
      });
    }
    return result;
  }

  private heritage(heritage: t.TSInterfaceHeritage, scope: Scope): TypeNode {
    const typeName =
      expressionName(heritage.expression) ?? this.text(heritage.expression);
    return {
      kind: "typeRef",
      repr: this.text(heritage),
      value: this.typeRef(typeName, heritage.typeArguments, scope),
    };
  }

  private enumDef(declaration: t.TSEnumDeclaration): EnumDef {
    return {
      members: declaration.body.members.map((member) => {
        const name =
          member.id.type === "Identifier" ? member.id.name : member.id.value;
        const init = member.initializer;
        if (!init) {
          return { name };
        }
        const literal = literalFromExpression(init);
        return {
          name,
          init: literal
            ? { kind: "literal", repr: this.text(init), value: literal }
            : { kind: "computed", repr: this.text(init) },
        };
      }),
    };
  }

  private members(members: t.TSTypeElement[], scope: Scope): TypeLiteralValue {
    const properties: PropertyDef[] = [];
    const indexSignatures: IndexSignatureDef[] = [];
    const methods: { name: string }[] = [];
    for (const member of members) {
      switch (member.type) {
        case "TSPropertySignature":
          properties.push({
            name: this.propertyName(member.key, member.computed),
            ...(member.optional ? { optional: true } : {}),
            ...(member.readonly ? { readonly: true } : {}),
            tsType: member.typeAnnotation
              ? this.type(member.typeAnnotation.typeAnnotation, scope)
              : null,
            location: this.location(member),
          });
          break;
        case "TSIndexSignature": {
          const parameter = member.parameters[0];
          indexSignatures.push({
            params: [
              {
                name: parameter?.name,
                tsType:
                  parameter?.typeAnnotation?.type === "TSTypeAnnotation"
                    ? this.type(parameter.typeAnnotation.typeAnnotation, scope)
                    : null,
              },
            ],
            tsType: member.typeAnnotation
              ? this.type(member.typeAnnotation.typeAnnotation, scope)
              : null,
          });
          break;
        }
        case "TSMethodSignature":
          methods.push({
            name: this.propertyName(member.key, member.computed),
          });
          break;
        default:
          break;
      }
    }
    return {
      ...(properties.length > 0 ? { properties } : {}),
      ...(indexSignatures.length > 0 ? { indexSignatures } : {}),
      ...(methods.length > 0 ? { methods } : {}),
    };
  }

  private propertyName(
    key: t.Expression | t.PrivateName,
    computed: boolean,
  ): string {
    if (!computed) {
      if (key.type === "Identifier") {
        return key.name;
      }
      if (key.type === "StringLiteral") {
        return key.value;
      }
      if (key.type === "NumericLiteral") {
        return String(key.value);
      }
    }
    return `[${this.text(key)}]`;
  }

  private typeRef(
    typeName: string,
    typeArguments: t.TSTypeParameterInstantiation | null | undefined,
    scope: Scope,
  ): TypeRefValue {
    const head = typeName.split(".")[0]!;
    const resolution: TypeRefValue["resolution"] = scope.has(head)
      ? { kind: "typeParam" }
      : this.declaredNames.has(head)
        ? { kind: "local" }
        : this.importedNames.has(head)
          ? { kind: "import" }
          : undefined;
    return {
      typeName,
      ...(typeArguments && typeArguments.params.length > 0
        ? {
            typeParams: typeArguments.params.map((argument) =>
              this.type(argument, scope),
            ),
          }
        : {}),
      ...(resolution ? { resolution } : {}),
    };
  }

  private type(node: t.TSType, scope: Scope): TypeNode {
    const repr = this.text(node);
    const keyword = KEYWORDS[node.type];
    if (keyword !== undefined) {
      return { kind: "keyword", repr, value: keyword };
    }
    switch (node.type) {
      case "TSLiteralType": {
        const literal = literalFromExpression(node.literal);
        return literal
          ? { kind: "literal", repr, value: literal }
          : { kind: "literal", repr, value: { kind: "template" } };
      }
      case "TSTemplateLiteralType":
        return { kind: "literal", repr, value: { kind: "template" } };
      case "TSTypeReference":
        return {
          kind: "typeRef",
          repr,
          value: this.typeRef(
            qualifiedName(node.typeName),
            node.typeArguments,
            scope,
          ),
        };
      case "TSUnionType":
        return {
          kind: "union",
          repr,
          value: node.types.map((member) => this.type(member, scope)),
        };
      case "TSIntersectionType":
        return {
          kind: "intersection",
          repr,
          value: node.types.map((member) => this.type(member, scope)),
        };
      case "TSArrayType":
        return {
          kind: "array",
          repr,
          value: this.type(node.elementType, scope),
        };
      case "TSTupleType":
        return {
          kind: "tuple",
          repr,
          value: node.elementTypes.map((element) =>
            this.tupleElement(element, scope),
          ),
        };
      case "TSTypeLiteral":
        return {
          kind: "typeLiteral",
          repr,
          value: this.members(node.members, scope),
        };
      case "TSParenthesizedType":
        return {
          kind: "parenthesized",
          repr,
          value: this.type(node.typeAnnotation, scope),
        };
      case "TSOptionalType":
        return {
          kind: "optional",
          repr,
          value: this.type(node.typeAnnotation, scope),
        };
      case "TSTypeOperator":
        return {
          kind: "typeOperator",
          repr,
          value: {
            operator: node.operator,
            tsType: this.type(node.typeAnnotation, scope),
          },
        };
      default:
        return { kind: OTHER_KINDS[node.type] ?? node.type, repr };
    }
  }

  private tupleElement(
    element: t.TSType | t.TSNamedTupleMember,
    scope: Scope,
  ): TypeNode {
    if (element.type === "TSNamedTupleMember") {
      const inner = this.type(element.elementType, scope);
      return element.optional
        ? { kind: "optional", repr: this.text(element), value: inner }
        : inner;
    }
    return this.type(element, scope);
  }

  private resolve(specifier: string): string | null {
    return this.options.resolve(specifier, this.options.url);
  }

  private text(node: t.Node): string {
    return this.options.source.slice(node.start ?? 0, node.end ?? 0);
  }

  private location(node: t.Node): SourceLocation {
    return {
      filename: this.options.url,
      line: node.loc?.start.line ?? 0,
      col: node.loc?.start.column ?? 0,
    };
  }
}

function paramScope(typeParams: TypeParamDef[]): Scope {
  return typeParams.length === 0
    ? NO_TYPE_PARAMS
    : new Set(typeParams.map((param) => param.name));
}

function declaredNames(declaration: t.Node): string[] {
  switch (declaration.type) {
    case "TSTypeAliasDeclaration":
    case "TSInterfaceDeclaration":
    case "TSEnumDeclaration":
    case "ClassDeclaration":
    case "FunctionDeclaration":
    case "TSDeclareFunction":
      return declaration.id ? [declaration.id.name] : [];
    case "VariableDeclaration":
      return declaration.declarations.flatMap((declarator) =>
        declarator.id.type === "Identifier" ? [declarator.id.name] : [],
      );
    case "TSModuleDeclaration":
      return declaration.id.type === "Identifier" ? [declaration.id.name] : [];
    default:
      return [];
  }
}

const DECLARATION_TYPES = new Set([
  "TSTypeAliasDeclaration",
  "TSInterfaceDeclaration",
  "TSEnumDeclaration",
  "ClassDeclaration",
  "FunctionDeclaration",
  "TSDeclareFunction",
  "VariableDeclaration",
  "TSModuleDeclaration",
]);

function isDeclaration(statement: t.Statement): statement is t.Declaration {
  return DECLARATION_TYPES.has(statement.type);
}

function kindOf(declaration: t.Declaration): string {
  switch (declaration.type) {
    case "ClassDeclaration":
      return "class";
    case "FunctionDeclaration":
    case "TSDeclareFunction":
      return "function";
    case "TSModuleDeclaration":
      return "namespace";
    default:
      return "variable";
  }
}

function moduleExportName(node: t.Identifier | t.StringLiteral): string {
  return node.type === "Identifier" ? node.name : node.value;
}

function qualifiedName(name: t.TSEntityName): string {
  switch (name.type) {
    case "Identifier":
      return name.name;
    case "ThisExpression":
      return "this";
    default:
      return `${qualifiedName(name.left)}.${name.right.name}`;
  }
}

function expressionName(expression: t.Expression): string | undefined {
  if (expression.type === "Identifier") {
    return expression.name;
  }
  if (
    expression.type === "MemberExpression" &&
    expression.property.type === "Identifier" &&
    expression.object.type !== "Super"
  ) {
    const object = expressionName(expression.object);
    return object === undefined
      ? undefined
      : `${object}.${expression.property.name}`;
  }
  return undefined;
}

function literalFromExpression(
  expression: t.Expression | t.TSLiteralType["literal"],
): LiteralValue | undefined {
  switch (expression.type) {
    case "StringLiteral":
      return { kind: "string", string: expression.value };
    case "NumericLiteral":
      return { kind: "number", number: expression.value };
    case "BooleanLiteral":
      return { kind: "boolean", boolean: expression.value };
    case "BigIntLiteral":
      return { kind: "bigInt", string: String(expression.value) };
    case "UnaryExpression":
      if (expression.argument.type === "NumericLiteral") {
        if (expression.operator === "-") {
          return { kind: "number", number: -expression.argument.value };
        }
        if (expression.operator === "+") {
          return { kind: "number", number: expression.argument.value };
        }
      }
      return undefined;
    default:
      return undefined;
  }
}

function formatError(error: unknown): string {
  const record =
    typeof error === "object" && error !== null
      ? (error as {
          reasonCode?: string;
          message?: string;
          loc?: { line: number; column: number };
        })
      : {};
  const where = record.loc ? `${record.loc.line}:${record.loc.column} ` : "";
  return `${where}${record.reasonCode ?? record.message ?? String(error)}`;
}
