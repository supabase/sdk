import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GeneratorError } from "../../errors.ts";
import type {
  ApiModel,
  ApiParameter,
  ApiSymbol,
  ApiType,
  SourcePosition,
} from "../../model.ts";
import {
  type Constraint,
  type Fragment,
  joinFragments,
  parameterDefaults,
  renderSignature,
  swiftLiteral,
} from "./declaration.ts";
import { unwrap } from "../../markdown.ts";
import { parseDocComment } from "./doc-comment.ts";

interface RawParameter {
  readonly name: string;
  readonly internalName?: string;
  readonly declarationFragments: readonly Fragment[];
}

/** The parts of a symbol graph symbol the generator reads. */
interface RawSymbol {
  readonly kind: { readonly identifier: string };
  readonly identifier: { readonly precise: string };
  readonly pathComponents: readonly string[];
  readonly docComment?: {
    readonly lines: readonly { readonly text: string }[];
  };
  readonly declarationFragments?: readonly Fragment[];
  readonly functionSignature?: {
    readonly parameters?: readonly RawParameter[];
    readonly returns?: readonly Fragment[];
  };
  readonly swiftGenerics?: {
    readonly parameters?: readonly { readonly name: string }[];
  };
  readonly swiftExtension?: {
    readonly extendedModule?: string;
    readonly constraints?: readonly Constraint[];
  };
  readonly availability?: readonly {
    readonly isUnconditionallyDeprecated?: boolean;
    readonly message?: string;
  }[];
  readonly spi?: boolean;
  readonly location?: {
    readonly uri: string;
    readonly position: { readonly line: number; readonly character: number };
  };
}

interface RawRelationship {
  readonly kind: string;
  readonly source: string;
  readonly target: string;
}

/** One `*.symbols.json` file, as the Swift compiler emits it. */
export interface SymbolGraph {
  readonly module: { readonly name: string };
  readonly symbols: readonly RawSymbol[];
  readonly relationships: readonly RawRelationship[];
}

const CALLABLE_KINDS = new Set([
  "swift.func",
  "swift.init",
  "swift.method",
  "swift.type.method",
]);
/** `Swift.RawRepresentable`, as symbol graphs identify it. */
const RAW_REPRESENTABLE = "s:SY";
const NO_RETURN = new Set(["", "()", "Void"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Checks the parts of a symbol graph that everything else relies on, so a
 * file that is not a symbol graph fails here and by name.
 */
export function parseSymbolGraph(json: unknown, file: string): SymbolGraph {
  const symbols = isRecord(json) ? json.symbols : undefined;
  const valid =
    isRecord(json) &&
    isRecord(json.module) &&
    typeof json.module.name === "string" &&
    Array.isArray(json.relationships) &&
    Array.isArray(symbols) &&
    symbols.every(
      (symbol) =>
        isRecord(symbol) &&
        isRecord(symbol.kind) &&
        typeof symbol.kind.identifier === "string" &&
        isRecord(symbol.identifier) &&
        typeof symbol.identifier.precise === "string" &&
        Array.isArray(symbol.pathComponents),
    );
  if (!valid) {
    throw new GeneratorError(`${file} is not a Swift symbol graph.`);
  }
  return json as unknown as SymbolGraph;
}

/** Reads every `*.symbols.json` file of a directory, in name order. */
export function readSymbolGraphs(directory: string): SymbolGraph[] {
  let names: string[];
  try {
    names = readdirSync(directory)
      .filter((name) => name.endsWith(".symbols.json"))
      .sort();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new GeneratorError(`Cannot read symbol graphs: ${reason}`);
  }
  return names.map((name) =>
    parseSymbolGraph(
      JSON.parse(readFileSync(join(directory, name), "utf8")),
      name,
    ),
  );
}

/** Last path component without argument labels: `signUp(email:)` is `signUp`. */
const baseName = (component: string): string => component.replace(/\(.*/, "");

/**
 * The name a definition id is made from: the path through the types, without
 * argument labels, so the overloads of a function share it. The module is not
 * part of it, because Swift code names a type without its module. Two modules
 * that each declare the name are told apart by `swiftModel`, which fails.
 */
const qualifiedName = (path: readonly string[]): string =>
  [...path.slice(0, -1), baseName(path.at(-1) ?? "")].join(".");

const positionOf = (symbol: RawSymbol): SourcePosition => ({
  file: symbol.location?.uri ?? "",
  line: symbol.location?.position.line ?? 0,
  column: symbol.location?.position.character ?? 0,
});

const docLines = (symbol: RawSymbol): string[] =>
  (symbol.docComment?.lines ?? []).map((line) => line.text);

/** The text after the first `: `, which every `name: Type` fragment list has. */
const afterColon = (text: string): string => text.slice(text.indexOf(": ") + 2);

interface Home {
  readonly module: string;
  readonly symbol: RawSymbol;
}

/**
 * Builds the API model from the symbol graphs of a package.
 *
 * `modules` are the modules to document. A build also emits a graph for each
 * dependency, and those are ignored.
 *
 * What the graphs hold is the public API: the build that emits them sets the
 * access level. So every function, method and initializer in them is handed
 * over.
 */
export function swiftModel(
  graphs: readonly SymbolGraph[],
  modules: readonly string[],
): ApiModel {
  // Sorted, so that nothing below depends on the order the graphs came in.
  const own = graphs
    .filter((graph) => modules.includes(graph.module.name))
    .sort((a, b) =>
      a.module.name < b.module.name
        ? -1
        : a.module.name > b.module.name
          ? 1
          : 0,
    );
  const missing = modules.filter(
    (module) => !own.some((graph) => graph.module.name === module),
  );
  if (missing.length > 0) {
    throw new GeneratorError("No symbol graph was found for:", missing);
  }

  // A module that re-exports another gets a copy of every symbol of it, and
  // the copy has lost its doc comment. Only the declaring module's copy has a
  // source location, so that is the one to keep.
  const homes = new Map<string, Home>();
  for (const graph of own) {
    for (const symbol of graph.symbols) {
      const id = symbol.identifier.precise;
      if (symbol.location && !homes.has(id)) {
        homes.set(id, { module: graph.module.name, symbol });
      }
    }
  }

  // Graphs repeat relationships and do not keep them in a stable order.
  const members = new Map<string, Set<string>>();
  const rawRepresentable = new Set<string>();
  for (const graph of own) {
    for (const { kind, source, target } of graph.relationships) {
      if (kind === "memberOf" && homes.has(source) && homes.has(target)) {
        members.set(target, (members.get(target) ?? new Set()).add(source));
      } else if (kind === "conformsTo" && target === RAW_REPRESENTABLE) {
        rawRepresentable.add(source);
      }
    }
  }

  /**
   * Whether a type is a bag of values a caller fills in: a struct. A class
   * is an object with behavior (`RealtimeChannel`), and a struct that wraps
   * a raw value is an open set of named values (`MessagingChannel`), whose
   * only stored property says nothing to a reader.
   */
  const inlined = (id: string | undefined): id is string =>
    id !== undefined &&
    homes.get(id)?.symbol.kind.identifier === "swift.struct" &&
    !rawRepresentable.has(id);

  /** Links a type to its symbol when it is one own type and nothing else. */
  const typeOf = (text: string, fragments: readonly Fragment[]): ApiType => {
    const named = fragments.filter(
      (fragment) => fragment.kind === "typeIdentifier",
    );
    const spelled = named.map((fragment) => fragment.spelling).join(".");
    const ref = named.at(-1)?.preciseIdentifier;
    return (text === spelled || text === `${spelled}?`) && inlined(ref)
      ? { text, ref }
      : { text };
  };

  const storedProperties = (id: string): string[] =>
    [...(members.get(id) ?? [])]
      .map((member) => homes.get(member)?.symbol)
      .filter((member): member is RawSymbol => member !== undefined)
      .filter(isSettableProperty)
      .sort(
        (a, b) =>
          positionOf(a).line - positionOf(b).line ||
          positionOf(a).column - positionOf(b).column,
      )
      .map((member) => member.identifier.precise);

  const symbols: ApiSymbol[] = [];
  for (const [id, { module, symbol }] of homes) {
    const kind = symbol.kind.identifier;
    const base = { id, position: positionOf(symbol) };
    const fragments = symbol.declarationFragments ?? [];
    if (CALLABLE_KINDS.has(kind)) {
      symbols.push({ ...base, ...callable(module, symbol, typeOf) });
    } else if (inlined(id)) {
      symbols.push({ ...base, kind: "type", properties: storedProperties(id) });
    } else if (kind === "swift.property") {
      const text = afterColon(joinFragments(fragments)).replace(
        /\s*\{[^}]*\}$/,
        "",
      );
      symbols.push({
        ...base,
        kind: "property",
        title: symbol.pathComponents.at(-1) ?? "",
        type: typeOf(text, fragments),
        required: !text.endsWith("?"),
        description: unwrap(parseDocComment(docLines(symbol)).description),
      });
    }
  }

  // Two modules can each declare a type or a function of one name. Their
  // callables would then pass for overloads of each other and share one
  // definition. `symbol` starts with the module that owns the type.
  const owners = new Map<string, Set<string>>();
  for (const symbol of symbols) {
    if (symbol.kind === "callable") {
      const owner = symbol.symbol.slice(0, symbol.symbol.indexOf("."));
      owners.set(
        symbol.name,
        (owners.get(symbol.name) ?? new Set()).add(owner),
      );
    }
  }
  const ambiguous = [...owners]
    .filter(([, modules]) => modules.size > 1)
    .map(([name, modules]) => `${name}: ${[...modules].sort().join(", ")}`)
    .sort();
  if (ambiguous.length > 0) {
    throw new GeneratorError(
      "More than one module declares a function of the same name, so their definitions would share an id:",
      ambiguous,
    );
  }

  return {
    language: "swift",
    symbols: symbols.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  };
}

/**
 * A stored property, or a computed one with a setter. A read-only computed
 * property (`{ get }`) is not something a caller fills in.
 */
function isSettableProperty(symbol: RawSymbol): boolean {
  if (symbol.kind.identifier !== "swift.property") {
    return false;
  }
  const accessors = /\{([^}]*)\}$/.exec(
    joinFragments(symbol.declarationFragments ?? []),
  );
  return accessors === null || /\bset\b/.test(accessors[1] ?? "");
}

function callable(
  module: string,
  symbol: RawSymbol,
  typeOf: (text: string, fragments: readonly Fragment[]) => ApiType,
) {
  const fragments = symbol.declarationFragments ?? [];
  const doc = parseDocComment(docLines(symbol));
  const signature = symbol.functionSignature;
  const declared = signature?.parameters ?? [];
  const defaults = parameterDefaults(fragments);
  if (defaults.length !== declared.length) {
    // The two lists describe one parameter clause. If they disagree, the
    // declaration has a form this parser does not know, and guessing would
    // attach defaults to the wrong parameters.
    throw new Error(
      `Cannot match the defaults of "${joinFragments(fragments)}" to its ${declared.length} parameters`,
    );
  }

  const parameters: ApiParameter[] = declared.map((parameter, index) => {
    const text = afterColon(joinFragments(parameter.declarationFragments));
    // `_` as the internal name means the body never reads the argument, and
    // the comment then documents the label.
    const internal =
      parameter.internalName === "_" ? undefined : parameter.internalName;
    const defaultValue = defaults[index];
    return {
      name: parameter.name,
      type: typeOf(text, parameter.declarationFragments),
      required: defaultValue === undefined,
      ...(defaultValue === undefined
        ? {}
        : { default: swiftLiteral(defaultValue) ?? defaultValue }),
      variadic: text.endsWith("..."),
      description:
        doc.parameters.get(internal ?? parameter.name) ??
        doc.parameters.get(parameter.name) ??
        "",
    };
  });

  const returns = joinFragments(signature?.returns ?? []);
  const deprecation = symbol.availability?.find(
    (availability) => availability.isUnconditionallyDeprecated,
  );
  const path = symbol.pathComponents;
  return {
    kind: "callable" as const,
    name: qualifiedName(path),
    // The module that declares it, also for an extension of another module's
    // type: that is where a reader of the SDK finds it.
    module,
    // A bare `init` says nothing in a list of pages, so it keeps its type.
    title:
      symbol.kind.identifier === "swift.init"
        ? qualifiedName(path)
        : baseName(path.at(-1) ?? ""),
    // An extension of another module's type is found under that module.
    symbol: [symbol.swiftExtension?.extendedModule ?? module, ...path].join(
      ".",
    ),
    signature: renderSignature(
      fragments,
      symbol.swiftExtension?.constraints ?? [],
    ),
    alternateSignatures: [],
    doc: {
      summary: doc.summary,
      description: doc.description,
      ...(doc.returns === undefined ? {} : { returns: doc.returns }),
      throws: doc.throws,
      examples: doc.examples,
    },
    parameters,
    ...(NO_RETURN.has(returns) ? {} : { returns: { text: returns } }),
    typeParams: (symbol.swiftGenerics?.parameters ?? []).map(
      (parameter) => parameter.name,
    ),
    // `@_spi` API can change in any release.
    stability: symbol.spi ? ("experimental" as const) : ("stable" as const),
    ...(deprecation === undefined
      ? {}
      : {
          deprecated:
            deprecation.message === undefined
              ? {}
              : { message: deprecation.message },
        }),
  };
}
