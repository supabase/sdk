/**
 * Turns the `deno doc --json` description of a function's entrypoint into the
 * {@link ContractType} language of the document.
 *
 * The contract of a function is formed by two exported type aliases or
 * interfaces of its entrypoint: `RequestBody` describes the JSON body the
 * function accepts, `ResponseBody` the JSON body it answers with. Either may
 * be absent. Every named type the two reach, in the entrypoint or in any
 * module of the project it imports, becomes a declaration the contract
 * points at through a `reference` node, so shared and recursive types keep
 * their identity. Generic types are instantiated at the point of use and
 * inlined. Anything TypeScript can say that JSON cannot carry becomes an
 * `unsupported` node together with a diagnostic naming the spot.
 */
import type {
  DocDeclaration,
  DocModule,
  EnumDef,
  IndexSignatureDef,
  InterfaceDef,
  TsType,
  TypeLiteralValue,
  TypeParamDef,
  TypeRefValue,
} from "./doc-nodes.ts";
import type {
  ContractDeclaration,
  ContractProperty,
  ContractType,
  Diagnostic,
} from "./types.ts";

/** Name of the export that describes the request body of a function. */
export const REQUEST_BODY_EXPORT = "RequestBody";
/** Name of the export that describes the response body of a function. */
export const RESPONSE_BODY_EXPORT = "ResponseBody";

export interface NormalizeContractOptions {
  /** Slug of the function, carried on every diagnostic. */
  readonly slug: string;
  /** URL of the entrypoint module in `modules`. */
  readonly entrypointUrl: string;
  /** Every documented module of the function, keyed by URL. */
  readonly modules: ReadonlyMap<string, DocModule>;
  /** How a module URL is shown in diagnostics; defaults to the URL itself. */
  readonly describeModule?: (url: string) => string;
}

export interface NormalizedContract {
  readonly requestBody: ContractType | null;
  readonly responseBody: ContractType | null;
  readonly types: ContractDeclaration[];
  readonly diagnostics: Diagnostic[];
}

interface Scope {
  readonly url: string;
  readonly typeParams: ReadonlyMap<string, ContractType>;
}

type TypeDeclaration = Extract<
  DocDeclaration,
  { kind: "typeAlias" } | { kind: "interface" } | { kind: "enum" }
>;

const UNKNOWN: ContractType = { kind: "unknown" };
const STRING: ContractType = { kind: "string" };
const BOOLEAN: ContractType = { kind: "boolean" };

/** Extract the contract of one function from its documented module graph. */
export function normalizeContract(
  options: NormalizeContractOptions,
): NormalizedContract {
  const describeModule = options.describeModule ?? ((url: string) => url);
  const diagnostics: Diagnostic[] = [];
  const declarations = new Map<string, ContractDeclaration | null>();
  const namesByKey = new Map<string, string>();

  const reported = new Set<string>();

  /** Record a diagnostic once; a body reached both as a root and as a declaration is converted twice. */
  function report(path: string, message: string): void {
    const key = `${path}\u0000${message}`;
    if (!reported.has(key)) {
      reported.add(key);
      diagnostics.push({ slug: options.slug, path, message });
    }
  }

  function unsupported(
    path: string,
    repr: string,
    message: string,
  ): ContractType {
    report(path, message);
    return { kind: "unsupported", repr };
  }

  function root(name: string): ContractType | null {
    const entry = options.modules.get(options.entrypointUrl);
    const symbol = entry?.symbols.find((candidate) => candidate.name === name);
    if (symbol === undefined) {
      return null;
    }
    const declaration = typeDeclarationOf(symbol.declarations);
    if (declaration === undefined) {
      report(
        name,
        `${name} must be a type alias, an interface or an enum to describe a body.`,
      );
      return null;
    }
    if (declaration.declarationKind !== "export") {
      report(
        name,
        `${name} is declared but not exported, so it is not part of the contract.`,
      );
      return null;
    }
    if ((typeParamsOf(declaration)?.length ?? 0) > 0) {
      report(
        name,
        `${name} is generic; a body type cannot have type parameters.`,
      );
      return null;
    }
    return convertDeclaration(
      declaration,
      { url: options.entrypointUrl, typeParams: new Map() },
      name,
    );
  }

  function convert(tsType: TsType, scope: Scope, path: string): ContractType {
    switch (tsType.kind) {
      case "keyword":
        return convertKeyword(tsType.value as string, path, tsType.repr);
      case "literal":
        return convertLiteral(
          tsType as Extract<TsType, { kind: "literal" }>,
          path,
        );
      case "array":
        return {
          kind: "array",
          element: convert(tsType.value as TsType, scope, `${path}[]`),
        };
      case "tuple":
        return {
          kind: "tuple",
          elements: (tsType.value as TsType[]).map((element, index) =>
            element.kind === "optional"
              ? unsupported(
                  `${path}[${index}]`,
                  element.repr ?? "optional",
                  "Optional tuple elements have no JSON representation.",
                )
              : convert(element, scope, `${path}[${index}]`),
          ),
        };
      case "parenthesized":
        return convert(tsType.value as TsType, scope, path);
      case "typeOperator": {
        const { operator, tsType: inner } = tsType.value as {
          operator: string;
          tsType: TsType;
        };
        if (operator === "readonly") {
          return convert(inner, scope, path);
        }
        return unsupported(
          path,
          tsType.repr ?? `${operator} ...`,
          `The ${operator} operator cannot be expressed as JSON.`,
        );
      }
      case "typeLiteral":
        return convertTypeLiteral(
          tsType.value as TypeLiteralValue,
          scope,
          path,
        );
      case "union":
        return convertUnion(tsType.value as TsType[], scope, path, false).type;
      case "intersection":
        return convertIntersection(
          tsType.value as TsType[],
          scope,
          path,
          tsType.repr,
        );
      case "typeRef":
        return convertTypeRef(
          tsType.value as TypeRefValue,
          scope,
          path,
          tsType.repr,
        );
      default:
        return unsupported(
          path,
          tsType.repr ?? tsType.kind,
          `A ${describeKind(tsType.kind)} cannot be expressed as JSON.`,
        );
    }
  }

  function convertKeyword(
    keyword: string,
    path: string,
    repr: string | undefined,
  ): ContractType {
    switch (keyword) {
      case "string":
      case "number":
      case "boolean":
      case "null":
        return { kind: keyword };
      case "any":
      case "unknown":
        return UNKNOWN;
      case "object":
        return { kind: "record", key: STRING, value: UNKNOWN };
      default:
        return unsupported(
          path,
          repr ?? keyword,
          `The ${keyword} type cannot be expressed as JSON.`,
        );
    }
  }

  function convertLiteral(
    tsType: Extract<TsType, { kind: "literal" }>,
    path: string,
  ): ContractType {
    const literal = tsType.value;
    switch (literal.kind) {
      case "string":
        return { kind: "literal", value: literal.string };
      case "number":
        return { kind: "literal", value: literal.number };
      case "boolean":
        return { kind: "literal", value: literal.boolean };
      case "template":
        return STRING;
      default:
        return unsupported(
          path,
          tsType.repr ?? literal.kind,
          `A ${literal.kind} literal cannot be expressed as JSON.`,
        );
    }
  }

  function convertUnion(
    members: TsType[],
    scope: Scope,
    path: string,
    dropUndefined: boolean,
  ): { type: ContractType; hadUndefined: boolean } {
    const flat: ContractType[] = [];
    let hadUndefined = false;
    for (const member of members) {
      const unwrapped = unwrapParenthesized(member);
      if (
        unwrapped.kind === "keyword" &&
        unwrapped.value === "undefined" &&
        dropUndefined
      ) {
        hadUndefined = true;
        continue;
      }
      if (unwrapped.kind === "union") {
        const nested = convertUnion(
          unwrapped.value as TsType[],
          scope,
          path,
          dropUndefined,
        );
        hadUndefined ||= nested.hadUndefined;
        flat.push(
          ...(nested.type.kind === "union"
            ? nested.type.members
            : [nested.type]),
        );
        continue;
      }
      const converted = convert(unwrapped, scope, path);
      flat.push(
        ...(converted.kind === "union" ? converted.members : [converted]),
      );
    }
    return { type: unionOf(flat, path), hadUndefined };
  }

  function unionOf(members: ContractType[], path: string): ContractType {
    const unique: ContractType[] = [];
    const seen = new Set<string>();
    for (const member of members) {
      const key = JSON.stringify(member);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(member);
      }
    }
    const hasTrue = unique.some(
      (m) => m.kind === "literal" && m.value === true,
    );
    const hasFalse = unique.some(
      (m) => m.kind === "literal" && m.value === false,
    );
    const collapsed =
      hasTrue && hasFalse
        ? [
            ...unique.filter(
              (m) => !(m.kind === "literal" && typeof m.value === "boolean"),
            ),
            BOOLEAN,
          ]
        : unique;
    if (collapsed.length === 0) {
      return unsupported(
        path,
        "never",
        "An empty union cannot be expressed as JSON.",
      );
    }
    if (collapsed.length === 1) {
      return collapsed[0]!;
    }
    return { kind: "union", members: collapsed };
  }

  function convertTypeLiteral(
    literal: TypeLiteralValue,
    scope: Scope,
    path: string,
  ): ContractType {
    for (const method of literal.methods ?? []) {
      report(
        `${path}.${method.name}`,
        `Methods have no JSON representation; ${method.name} is left out.`,
      );
    }
    const properties: ContractProperty[] = (literal.properties ?? []).map(
      (property) =>
        convertProperty(property, scope, `${path}.${property.name}`),
    );
    const additional = convertIndexSignatures(
      literal.indexSignatures ?? [],
      scope,
      path,
    );
    if (properties.length === 0 && additional !== undefined) {
      return { kind: "record", key: additional.key, value: additional.value };
    }
    return additional === undefined
      ? { kind: "object", properties }
      : { kind: "object", properties, additionalProperties: additional.value };
  }

  function convertProperty(
    property: { name: string; optional?: boolean; tsType?: TsType | null },
    scope: Scope,
    path: string,
  ): ContractProperty {
    const tsType = property.tsType ?? undefined;
    if (tsType === undefined) {
      return {
        name: property.name,
        type: UNKNOWN,
        optional: property.optional === true,
      };
    }
    const unwrapped = unwrapParenthesized(tsType);
    if (unwrapped.kind === "union") {
      const { type, hadUndefined } = convertUnion(
        unwrapped.value as TsType[],
        scope,
        path,
        true,
      );
      return {
        name: property.name,
        type,
        optional: property.optional === true || hadUndefined,
      };
    }
    return {
      name: property.name,
      type: convert(unwrapped, scope, path),
      optional: property.optional === true,
    };
  }

  function convertIndexSignatures(
    signatures: IndexSignatureDef[],
    scope: Scope,
    path: string,
  ): { key: ContractType; value: ContractType } | undefined {
    const [first, ...rest] = signatures;
    if (first === undefined) {
      return undefined;
    }
    for (const _ of rest) {
      report(path, "Only the first index signature of a type is kept.");
    }
    const keyType = first.params[0]?.tsType ?? undefined;
    const key =
      keyType === undefined ? STRING : convert(keyType, scope, `${path}[key]`);
    const valueType = first.tsType ?? undefined;
    const value =
      valueType === undefined
        ? UNKNOWN
        : convert(valueType, scope, `${path}[value]`);
    return { key, value };
  }

  function convertIntersection(
    members: TsType[],
    scope: Scope,
    path: string,
    repr: string | undefined,
  ): ContractType {
    const parts = members.map((member) => convert(member, scope, path));
    return (
      mergeObjects(parts) ??
      unsupported(
        path,
        repr ?? parts.map((part) => JSON.stringify(part)).join(" & "),
        "Only intersections of object types can be expressed as JSON.",
      )
    );
  }

  /** Merge object and record parts into one object; `undefined` when a part is neither. */
  function mergeObjects(parts: ContractType[]): ContractType | undefined {
    const properties = new Map<string, ContractProperty>();
    let additionalProperties: ContractType | undefined;
    for (const part of parts) {
      const resolved = resolveReference(part);
      if (resolved === undefined) {
        return undefined;
      }
      if (resolved.kind === "object") {
        for (const property of resolved.properties) {
          properties.set(property.name, property);
        }
        additionalProperties =
          resolved.additionalProperties ?? additionalProperties;
      } else if (resolved.kind === "record") {
        additionalProperties = resolved.value;
      } else {
        return undefined;
      }
    }
    const merged: ContractType = {
      kind: "object",
      properties: [...properties.values()],
    };
    return additionalProperties === undefined
      ? merged
      : { ...merged, additionalProperties };
  }

  /** Follow a `reference` to its declaration; `undefined` while it is still being built. */
  function resolveReference(type: ContractType): ContractType | undefined {
    if (type.kind !== "reference") {
      return type;
    }
    return declarations.get(type.name)?.type;
  }

  function convertTypeRef(
    ref: TypeRefValue,
    scope: Scope,
    path: string,
    repr: string | undefined,
  ): ContractType {
    const display = repr ?? ref.typeName;
    const resolution = ref.resolution;
    const typeArgs = ref.typeParams ?? [];
    if (resolution?.kind === "typeParam") {
      return (
        scope.typeParams.get(ref.typeName) ??
        unsupported(
          path,
          display,
          `The type parameter ${ref.typeName} is not bound here.`,
        )
      );
    }
    if (resolution?.kind === "local") {
      return convertNamed(
        scope.url,
        ref.typeName,
        typeArgs,
        scope,
        path,
        display,
      );
    }
    if (resolution?.kind === "import") {
      return convertImported(ref, scope, path, display);
    }
    return convertBuiltin(ref.typeName, typeArgs, scope, path, display);
  }

  function convertImported(
    ref: TypeRefValue,
    scope: Scope,
    path: string,
    display: string,
  ): ContractType {
    const [head, ...tail] = ref.typeName.split(".");
    const imported = options.modules
      .get(scope.url)
      ?.imports?.find((candidate) => candidate.importedName === head);
    if (imported === undefined) {
      return unsupported(
        path,
        display,
        `${display} could not be traced to its import.`,
      );
    }
    if (tail.length > 0 || imported.originalName === "*") {
      return unsupported(
        path,
        display,
        `${display} is reached through a namespace import; import the type by name instead.`,
      );
    }
    if (!imported.src.startsWith("file:")) {
      return unsupported(
        path,
        display,
        `${display} comes from ${imported.src}; only types declared in the project are extracted.`,
      );
    }
    if (!options.modules.has(imported.src)) {
      return unsupported(
        path,
        display,
        `${display} is declared in ${describeModule(imported.src)}, which was not documented.`,
      );
    }
    return convertNamed(
      imported.src,
      imported.originalName,
      ref.typeParams ?? [],
      scope,
      path,
      display,
    );
  }

  function convertBuiltin(
    name: string,
    typeArgs: TsType[],
    scope: Scope,
    path: string,
    display: string,
  ): ContractType {
    const argument = (
      index: number,
      suffix: string,
    ): ContractType | undefined => {
      const arg = typeArgs[index];
      return arg === undefined
        ? undefined
        : convert(arg, scope, `${path}${suffix}`);
    };
    switch (name) {
      case "Array":
      case "ReadonlyArray":
        return { kind: "array", element: argument(0, "[]") ?? UNKNOWN };
      case "Record": {
        const key = argument(0, "[key]") ?? STRING;
        const value = argument(1, "[value]") ?? UNKNOWN;
        return isRecordKey(key)
          ? { kind: "record", key, value }
          : unsupported(
              path,
              display,
              "Record keys must be strings or a union of string literals.",
            );
      }
      case "Readonly":
        return argument(0, "") ?? UNKNOWN;
      case "NonNullable": {
        const inner = argument(0, "") ?? UNKNOWN;
        return inner.kind === "union"
          ? unionOf(
              inner.members.filter((member) => member.kind !== "null"),
              path,
            )
          : inner;
      }
      case "Partial":
      case "Required": {
        const inner = argument(0, "");
        const resolved =
          inner === undefined ? undefined : resolveReference(inner);
        if (resolved?.kind !== "object") {
          return unsupported(
            path,
            display,
            `${name} is only supported on object types.`,
          );
        }
        return {
          ...resolved,
          properties: resolved.properties.map((property) => ({
            ...property,
            optional: name === "Partial",
          })),
        };
      }
      default:
        return unsupported(
          path,
          display,
          `${display} cannot be expressed as JSON.`,
        );
    }
  }

  function convertNamed(
    url: string,
    symbolName: string,
    typeArgs: TsType[],
    callerScope: Scope,
    path: string,
    display: string,
  ): ContractType {
    const module = options.modules.get(url);
    const symbol = module?.symbols.find(
      (candidate) => candidate.name === symbolName,
    );
    const declaration =
      symbol === undefined ? undefined : typeDeclarationOf(symbol.declarations);
    if (symbol === undefined || declaration === undefined) {
      return unsupported(
        path,
        display,
        symbol === undefined
          ? `${display} is not declared in ${describeModule(url)}.`
          : `${display} is a ${symbol.declarations[0]?.kind ?? "value"}, not a type.`,
      );
    }
    const typeParams = typeParamsOf(declaration) ?? [];
    if (typeParams.length > 0) {
      return convertDeclaration(
        declaration,
        {
          url,
          typeParams: bindTypeParams(
            typeParams,
            typeArgs,
            callerScope,
            url,
            path,
          ),
        },
        path,
      );
    }
    if (typeArgs.length > 0) {
      report(path, `${display} takes no type arguments; they are ignored.`);
    }
    const name = declarationName(url, symbolName, path);
    if (!declarations.has(name)) {
      declarations.set(name, null);
      const type = convertDeclaration(
        declaration,
        { url, typeParams: new Map() },
        name,
      );
      declarations.set(name, { name, type });
    }
    return { kind: "reference", name };
  }

  function bindTypeParams(
    params: TypeParamDef[],
    args: TsType[],
    callerScope: Scope,
    declarationUrl: string,
    path: string,
  ): Map<string, ContractType> {
    const bound = new Map<string, ContractType>();
    params.forEach((param, index) => {
      const arg = args[index];
      if (arg !== undefined) {
        bound.set(param.name, convert(arg, callerScope, `${path}<${index}>`));
      } else if (param.default !== undefined && param.default !== null) {
        bound.set(
          param.name,
          convert(
            param.default,
            { url: declarationUrl, typeParams: bound },
            `${path}<${index}>`,
          ),
        );
      } else {
        bound.set(
          param.name,
          unsupported(
            `${path}<${index}>`,
            param.name,
            `No type argument given for ${param.name}.`,
          ),
        );
      }
    });
    return bound;
  }

  /** A stable output name per (module, symbol); a clash with another module gets a suffix. */
  function declarationName(
    url: string,
    symbolName: string,
    path: string,
  ): string {
    const key = `${url}#${symbolName}`;
    const existing = namesByKey.get(key);
    if (existing !== undefined) {
      return existing;
    }
    let name = symbolName;
    for (let suffix = 2; declarations.has(name); suffix += 1) {
      name = `${symbolName}${suffix}`;
    }
    if (name !== symbolName) {
      report(
        path,
        `${symbolName} in ${describeModule(url)} is emitted as ${name}, since another module declares a ${symbolName} too.`,
      );
    }
    namesByKey.set(key, name);
    return name;
  }

  function convertDeclaration(
    declaration: TypeDeclaration,
    scope: Scope,
    path: string,
  ): ContractType {
    switch (declaration.kind) {
      case "typeAlias":
        return convert(declaration.def.tsType, scope, path);
      case "interface":
        return convertInterface(declaration.def, scope, path);
      case "enum":
        return convertEnum(declaration.def, path);
    }
  }

  function convertInterface(
    def: InterfaceDef,
    scope: Scope,
    path: string,
  ): ContractType {
    const own = convertTypeLiteral(def, scope, path);
    const bases = (def.extends ?? []).map((base) => convert(base, scope, path));
    if (bases.length === 0) {
      return own;
    }
    return (
      mergeObjects([...bases, own]) ??
      unsupported(
        path,
        (def.extends ?? []).map((base) => base.repr ?? "?").join(" & "),
        "An interface can only extend object types in a JSON contract.",
      )
    );
  }

  function convertEnum(def: EnumDef, path: string): ContractType {
    const members: ContractType[] = [];
    let nextValue = 0;
    for (const member of def.members) {
      const init = member.init ?? undefined;
      if (init === undefined) {
        members.push({ kind: "literal", value: nextValue });
        nextValue += 1;
        continue;
      }
      if (init.kind === "literal") {
        const literal = convertLiteral(
          init as Extract<TsType, { kind: "literal" }>,
          `${path}.${member.name}`,
        );
        members.push(literal);
        if (literal.kind === "literal" && typeof literal.value === "number") {
          nextValue = literal.value + 1;
        }
        continue;
      }
      members.push(
        unsupported(
          `${path}.${member.name}`,
          init.repr ?? member.name,
          `Enum member ${member.name} is computed; only literal members are supported.`,
        ),
      );
    }
    return unionOf(members, path);
  }

  const requestBody = root(REQUEST_BODY_EXPORT);
  const responseBody = root(RESPONSE_BODY_EXPORT);
  const types: ContractDeclaration[] = [];
  for (const declaration of declarations.values()) {
    if (declaration !== null) {
      types.push(declaration);
    }
  }
  return { requestBody, responseBody, types, diagnostics };
}

function typeDeclarationOf(
  declarations: DocDeclaration[],
): TypeDeclaration | undefined {
  return declarations.find(
    (declaration): declaration is TypeDeclaration =>
      declaration.kind === "typeAlias" ||
      declaration.kind === "interface" ||
      declaration.kind === "enum",
  );
}

function typeParamsOf(
  declaration: TypeDeclaration,
): TypeParamDef[] | undefined {
  return declaration.kind === "enum" ? undefined : declaration.def.typeParams;
}

function unwrapParenthesized(tsType: TsType): TsType {
  let current = tsType;
  while (current.kind === "parenthesized") {
    current = current.value as TsType;
  }
  return current;
}

function isRecordKey(key: ContractType): boolean {
  if (key.kind === "string") {
    return true;
  }
  if (key.kind === "literal") {
    return typeof key.value === "string";
  }
  return (
    key.kind === "union" && key.members.every((member) => isRecordKey(member))
  );
}

function describeKind(kind: string): string {
  switch (kind) {
    case "indexedAccess":
      return 'property lookup type (T["key"])';
    case "typeQuery":
      return "typeof query";
    case "conditional":
      return "conditional type";
    case "mapped":
      return "mapped type";
    case "fnOrConstructor":
      return "function type";
    case "infer":
      return "infer type";
    case "importType":
      return "import() type";
    default:
      return `${kind} type`;
  }
}
