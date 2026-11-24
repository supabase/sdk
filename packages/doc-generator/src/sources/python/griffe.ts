import { readFileSync } from "node:fs";
import type { GriffeSource } from "../../config.ts";
import { GeneratorError } from "../../errors.ts";
import { unwrap } from "../../markdown.ts";
import type {
  ApiModel,
  ApiParameter,
  ApiSymbol,
  ApiType,
  CallableSymbol,
} from "../../model.ts";
import { type Docstring, parseDocstring } from "./docstring.ts";
import { type Expr, type ExprNode, pythonLiteral, renderExpr } from "./expr.ts";

interface GriffeParameter {
  readonly name: string;
  readonly kind: string;
  readonly annotation: Expr | null;
  readonly default: Expr | null;
}

/** One object of a `griffe dump`: a module, class, function and so on. */
interface GriffeObject {
  readonly kind: string;
  readonly name: string;
  readonly path: string;
  readonly members?: Readonly<Record<string, GriffeObject>>;
  /** Aliases only: what an import or a re-export points at. */
  readonly target_path?: string;
  readonly labels?: readonly string[];
  /**
   * Whether its parent exposes it: named in `__all__` when the parent has
   * one, and otherwise not an underscore name and not a plain import. Only a
   * `--full` dump has it.
   */
  readonly is_public?: boolean;
  /** A method named `__like_this__`. */
  readonly is_special?: boolean;
  readonly lineno?: number;
  readonly relative_package_filepath?: string;
  /** Set by griffe extensions only. A plain dump never sets it. */
  readonly is_deprecated?: boolean;
  readonly decorators?: readonly { readonly value: Expr }[];
  readonly docstring?: Docstring;
  readonly bases?: readonly Expr[];
  readonly parameters?: readonly GriffeParameter[];
  readonly returns?: Expr | null;
  readonly annotation?: Expr | null;
  readonly value?: Expr | null;
  readonly type_parameters?: readonly {
    readonly name: string;
    readonly kind: string;
    readonly annotation: Expr | null;
  }[];
}

/** A `griffe dump`: the packages it loaded, by name. */
export type GriffeDump = Readonly<Record<string, GriffeObject>>;

type Options = Omit<GriffeSource, "format" | "file">;

/** Base classes whose subclasses declare their fields as annotations. */
const MODEL_BASES = new Set(["pydantic.BaseModel", "pydantic.main.BaseModel"]);
const LITERAL = new Set(["typing.Literal", "typing_extensions.Literal"]);
/** The decorator of PEP 702, which marks what it decorates as deprecated. */
const DEPRECATED = new Set([
  "warnings.deprecated",
  "typing_extensions.deprecated",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNode = (expr: Expr | null | undefined): expr is ExprNode =>
  typeof expr === "object" && expr !== null;

const parentOf = (path: string): string =>
  path.slice(0, Math.max(path.lastIndexOf("."), 0));

const membersOf = (object: GriffeObject): GriffeObject[] =>
  Object.values(object.members ?? {});

/**
 * Checks that a JSON document is a `griffe dump` the generator can read, so
 * a wrong file fails here and not somewhere inside the generator.
 */
export function parseGriffeDump(json: unknown, file: string): GriffeDump {
  const roots = isRecord(json) ? Object.values(json) : [];
  const isDump =
    roots.length > 0 &&
    roots.every(
      (object) =>
        isRecord(object) &&
        object.kind === "module" &&
        isRecord(object.members),
    );
  if (!isDump) {
    throw new GeneratorError(`${file} is not a griffe dump.`);
  }
  // Only a `--full` dump has paths and says what is public. Without that,
  // nothing in it would count as public, and a run would write no
  // definitions and call that a success.
  const isFull = roots.every(
    (object) =>
      isRecord(object) &&
      typeof object.path === "string" &&
      typeof object.is_public === "boolean",
  );
  if (!isFull) {
    throw new GeneratorError(
      `${file} does not say what is public. Write it with \`griffe dump --full\`.`,
    );
  }
  return json as GriffeDump;
}

export function readGriffeDump(file: string): GriffeDump {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new GeneratorError(`Cannot read the griffe dump: ${reason}`);
  }
  return parseGriffeDump(JSON.parse(text), file);
}

/** `X` of `X | None`, the way an optional value is annotated. */
function withoutNone(expr: Expr): Expr {
  if (isNode(expr) && expr.cls === "ExprBinOp" && expr.operator === "|") {
    if (expr.right === "None") {
      return expr.left as Expr;
    }
    if (expr.left === "None") {
      return expr.right as Expr;
    }
  }
  return expr;
}

/** The parameter list of a signature, with the `/` and `*` markers. */
function renderParameters(parameters: readonly GriffeParameter[]): string {
  const parts: string[] = [];
  let positionalOnly = false;
  let keywordOnly = false;
  for (const parameter of parameters) {
    if (parameter.kind === "positional-only") {
      positionalOnly = true;
    } else if (positionalOnly) {
      parts.push("/");
      positionalOnly = false;
    }
    // After `*args`, every parameter is keyword-only without a bare `*`.
    if (parameter.kind === "keyword-only" && !keywordOnly) {
      parts.push("*");
    }
    keywordOnly ||= ["keyword-only", "variadic positional"].includes(
      parameter.kind,
    );
    const variadic = parameter.kind.startsWith("variadic");
    const stars =
      parameter.kind === "variadic positional"
        ? "*"
        : parameter.kind === "variadic keyword"
          ? "**"
          : "";
    const annotation =
      parameter.annotation === null
        ? ""
        : `: ${renderExpr(parameter.annotation)}`;
    // griffe gives `*args` and `**kwargs` the defaults `()` and `{}`.
    const value =
      parameter.default === null || variadic
        ? ""
        : `${annotation === "" ? "=" : " = "}${renderExpr(parameter.default)}`;
    parts.push(`${stars}${parameter.name}${annotation}${value}`);
  }
  if (positionalOnly) {
    parts.push("/");
  }
  return parts.join(", ");
}

/** PEP 695 type parameters: `[T: Bound, *Ts, **P]`. */
function renderTypeParameters(object: GriffeObject): string {
  const parameters = object.type_parameters ?? [];
  if (parameters.length === 0) {
    return "";
  }
  const rendered = parameters.map((parameter) => {
    const stars =
      parameter.kind === "type-var-tuple"
        ? "*"
        : parameter.kind === "param-spec"
          ? "**"
          : "";
    const bound =
      parameter.annotation === null
        ? ""
        : `: ${renderExpr(parameter.annotation)}`;
    return `${stars}${parameter.name}${bound}`;
  });
  return `[${rendered.join(", ")}]`;
}

/**
 * Builds the API model from a `griffe dump`.
 *
 * The dump holds signatures and docstrings as griffe parsed them, but names
 * unresolved: an annotation says `AuthResponse`, not where it is defined. So
 * this resolves names itself, through the scopes and the import aliases the
 * dump records, to find the classes whose fields are inlined and the wrapper
 * types to see through.
 *
 * A function is part of the API when a caller can import it by public names
 * alone, and it is named by that import path. Where it is defined does not
 * matter: a class in a private module that its package re-exports is public,
 * under the name of the package.
 */
export function griffeModel(dump: GriffeDump, options: Options = {}): ApiModel {
  const objects = new Map<string, GriffeObject>();
  const collect = (object: GriffeObject): void => {
    objects.set(object.path, object);
    for (const member of membersOf(object)) {
      collect(member);
    }
  };
  const roots = Object.keys(dump)
    .sort()
    .map((name) => dump[name])
    .filter((root): root is GriffeObject => root !== undefined);
  roots.forEach(collect);

  /**
   * Follows imports and re-exports to where a name is defined. A path that
   * leaves the dump (the standard library, a dependency) is returned as is.
   */
  const resolvePath = (path: string, seen: readonly string[] = []): string => {
    const target = objects.get(path)?.target_path;
    // `seen` ends the walk on imports that point at each other.
    return target === undefined || seen.includes(path)
      ? path
      : resolvePath(target, [...seen, path]);
  };

  /**
   * Every import path of public names, by the path the object is defined at.
   * A package that is dumped is public by being named on the command line.
   */
  const publicPaths = new Map<string, string[]>();
  const expose = (
    object: GriffeObject,
    path: string,
    through: readonly string[],
  ): void => {
    const defined = resolvePath(object.path);
    const target = objects.get(defined);
    // An import of something outside the dump, or one that never ends.
    if (target === undefined || target.kind === "alias") {
      return;
    }
    publicPaths.set(defined, [...(publicPaths.get(defined) ?? []), path]);
    // `through` ends the walk on a module that exposes one it is inside of.
    if (
      (target.kind === "module" || target.kind === "class") &&
      !through.includes(defined)
    ) {
      for (const member of membersOf(target)) {
        if (member.is_public) {
          expose(member, `${path}.${member.name}`, [...through, defined]);
        }
      }
    }
  };
  for (const root of roots) {
    expose(root, root.path, []);
  }

  const packageOf = (path: string): string => path.split(".", 1)[0] ?? path;

  /**
   * The one import path a function is named by, or `undefined` when it has
   * none. The id of its definition is made from this, so the choice must not
   * move when another package starts to re-export the function: a path in
   * the package that defines it wins. Then the shortest wins, which is the
   * one a package offers at its top, and then the first in the alphabet.
   */
  const publicName = (defined: string): string | undefined => {
    const paths = publicPaths.get(defined) ?? [];
    const own = paths.filter((path) => packageOf(path) === packageOf(defined));
    const depth = (path: string): number => path.split(".").length;
    return [...(own.length > 0 ? own : paths)].sort(
      (a, b) => depth(a) - depth(b) || (a < b ? -1 : a > b ? 1 : 0),
    )[0];
  };

  /**
   * Resolves a name the way Python does for an annotation: in the enclosing
   * classes, then in the module. `undefined` is a builtin or a type variable.
   */
  const resolveName = (scope: string, name: string): string | undefined => {
    for (let path = scope; path !== ""; path = parentOf(path)) {
      const object = objects.get(path);
      if (object?.members?.[name] !== undefined) {
        return resolvePath(`${path}.${name}`);
      }
      if (object?.kind === "module") {
        return undefined;
      }
    }
    return undefined;
  };

  /** Where the class or type an expression names is defined, if it names one. */
  const resolveExpr = (expr: Expr, scope: string): string | undefined => {
    if (!isNode(expr)) {
      return undefined;
    }
    if (expr.cls === "ExprName") {
      return resolveName(scope, String(expr.name));
    }
    if (expr.cls === "ExprSubscript") {
      return resolveExpr(expr.left as Expr, scope);
    }
    if (expr.cls === "ExprAttribute") {
      const [first, ...rest] = (expr.values as Expr[]).map(renderExpr);
      const head = first === undefined ? undefined : resolveName(scope, first);
      return head === undefined
        ? undefined
        : resolvePath([head, ...rest].join("."));
    }
    return undefined;
  };

  /** Classes whose annotated attributes are the fields a caller fills in. */
  const fieldClasses = new Map<string, boolean>();
  const hasFields = (path: string): boolean => {
    const known = fieldClasses.get(path);
    if (known !== undefined) {
      return known;
    }
    fieldClasses.set(path, false); // Ends the recursion on a cycle of bases.
    const object = objects.get(path);
    const result =
      object?.kind === "class" &&
      ((object.labels ?? []).includes("dataclass") ||
        (object.bases ?? []).some((base) => {
          const resolved = resolveExpr(base, parentOf(path));
          return (
            resolved !== undefined &&
            (MODEL_BASES.has(resolved) || hasFields(resolved))
          );
        }));
    fieldClasses.set(path, result);
    return result;
  };

  // griffe labels what an instance carries `instance-attribute`. A
  // `ClassVar` and a property do not get the label.
  const isField = (member: GriffeObject): boolean =>
    member.kind === "attribute" &&
    !member.name.startsWith("_") &&
    (member.labels ?? []).includes("instance-attribute");

  /** Field paths by name: inherited fields first, each in source order. */
  const fieldsOf = (
    path: string,
    seen: readonly string[] = [],
  ): Map<string, string> => {
    const fields = new Map<string, string>();
    const object = objects.get(path);
    if (object?.kind !== "class" || seen.includes(path)) {
      return fields;
    }
    for (const base of object.bases ?? []) {
      const resolved = resolveExpr(base, parentOf(path));
      if (resolved !== undefined) {
        for (const [name, field] of fieldsOf(resolved, [...seen, path])) {
          fields.set(name, field);
        }
      }
    }
    // The dump lists members by name; a class declares them by line.
    const own = membersOf(object)
      .filter(isField)
      .sort(
        (a, b) =>
          (a.lineno ?? 0) - (b.lineno ?? 0) || (a.name < b.name ? -1 : 1),
      );
    for (const member of own) {
      fields.set(member.name, member.path);
    }
    return fields;
  };

  const typeOf = (expr: Expr, scope: string): ApiType => {
    const text = renderExpr(expr);
    const named = withoutNone(expr);
    // Only a bare class name is inlined: `list[Options]` is not `Options`.
    const ref =
      isNode(named) && named.cls !== "ExprSubscript"
        ? resolveExpr(named, scope)
        : undefined;
    return ref !== undefined && hasFields(ref) ? { text, ref } : { text };
  };

  /** The values of a `Literal[...]` annotation, when all are plain literals. */
  const allowedValues = (
    expr: Expr,
    scope: string,
  ): (string | number | boolean)[] => {
    const literal = withoutNone(expr);
    if (!isNode(literal) || literal.cls !== "ExprSubscript") {
      return [];
    }
    const origin = resolveExpr(literal.left as Expr, scope);
    if (origin === undefined || !LITERAL.has(origin)) {
      return [];
    }
    const slice = literal.slice as Expr;
    const elements =
      isNode(slice) && slice.cls === "ExprTuple"
        ? (slice.elements as Expr[])
        : [slice];
    const values = elements.map((element) =>
      typeof element === "string" ? pythonLiteral(element) : undefined,
    );
    return values.every((value) => value !== undefined) ? values : [];
  };

  const docOf = (object: GriffeObject) => parseDocstring(object.docstring);

  /**
   * Whether a function is deprecated, and the message it gives. griffe does
   * not work this out in a plain dump, so the `@deprecated` decorator is read
   * here: its first argument is the message.
   */
  const deprecationOf = (
    object: GriffeObject,
    scope: string,
  ): { readonly message?: string } | undefined => {
    for (const { value } of object.decorators ?? []) {
      const call =
        isNode(value) && value.cls === "ExprCall" ? value : undefined;
      const decorator = call === undefined ? value : (call.function as Expr);
      const path = resolveExpr(decorator, scope);
      if (path === undefined || !DEPRECATED.has(path)) {
        continue;
      }
      const [first] = (call?.arguments ?? []) as Expr[];
      const message =
        typeof first === "string" ? pythonLiteral(first) : undefined;
      return typeof message === "string" ? { message } : {};
    }
    return object.is_deprecated ? {} : undefined;
  };

  const callable = (
    object: GriffeObject,
    name: string,
  ): Omit<CallableSymbol, "id" | "position"> => {
    const scope = parentOf(object.path);
    const labels = object.labels ?? [];
    const inClass = objects.get(scope)?.kind === "class";
    // The receiver (`self`, `cls`) is not something a caller passes.
    const declared = (object.parameters ?? []).slice(
      inClass && !labels.includes("staticmethod") ? 1 : 0,
    );
    const doc = docOf(object);
    const deprecation = deprecationOf(object, scope);

    const parameters: ApiParameter[] = declared.map((parameter) => {
      const variadic = parameter.kind.startsWith("variadic");
      const source =
        parameter.default === null || variadic
          ? undefined
          : renderExpr(parameter.default);
      const allowed =
        parameter.annotation === null
          ? []
          : allowedValues(parameter.annotation, scope);
      return {
        name: parameter.name,
        ...(parameter.annotation === null
          ? {}
          : { type: typeOf(parameter.annotation, scope) }),
        required: source === undefined && !variadic,
        ...(source === undefined
          ? {}
          : { default: pythonLiteral(source) ?? source }),
        variadic,
        ...(allowed.length === 0 ? {} : { allowedValues: allowed }),
        description: doc.parameters.get(parameter.name) ?? "",
      };
    });

    // A method declared once for a sync and an async client returns a
    // wrapper around its result. A caller gets the result, or awaits it.
    const declaredReturn = object.returns ?? null;
    const wrapper =
      isNode(declaredReturn) && declaredReturn.cls === "ExprSubscript"
        ? resolveExpr(declaredReturn.left as Expr, scope)
        : undefined;
    const unwrapped =
      wrapper !== undefined && (options.unwrapReturns ?? []).includes(wrapper);
    const returned =
      unwrapped && isNode(declaredReturn)
        ? (declaredReturn.slice as Expr)
        : declaredReturn;
    const returns = returned === null ? undefined : renderExpr(returned);

    const head = `def ${object.name}${renderTypeParameters(object)}(${renderParameters(declared)})`;
    const signature = `${head}${returns === undefined ? "" : ` -> ${returns}`}`;
    const isAsync = labels.includes("async");

    const prefix = options.symbolPaths?.[parentOf(name)];
    return {
      kind: "callable",
      name,
      module: packageOf(name),
      title: object.name,
      symbol:
        prefix === undefined
          ? name
          : `${prefix}${name.slice(name.lastIndexOf("."))}`,
      signature: isAsync ? `async ${signature}` : signature,
      alternateSignatures: unwrapped ? [`async ${signature}`] : [],
      doc: {
        summary: doc.summary,
        description: doc.description,
        ...(doc.returns === undefined ? {} : { returns: doc.returns }),
        throws: doc.throws,
        examples: doc.examples,
      },
      parameters,
      ...(returned === null || returns === "None"
        ? {}
        : { returns: typeOf(returned, scope) }),
      typeParams: (object.type_parameters ?? []).map(
        (parameter) => parameter.name,
      ),
      stability: "stable",
      ...(deprecation === undefined ? {} : { deprecated: deprecation }),
    };
  };

  const symbols: ApiSymbol[] = [];
  const owners = new Set<string>();
  const inPathOrder = [...objects].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  for (const [path, object] of inPathOrder) {
    const base = {
      id: path,
      position: {
        file: object.relative_package_filepath ?? "",
        line: object.lineno ?? 0,
        column: 0,
      },
    };
    const owner = objects.get(parentOf(path));
    if (object.kind === "function") {
      const name = publicName(path);
      // A function that no public name leads to is not part of the API. Nor
      // is a special method without a docstring: a caller reaches it through
      // syntax (`with`, `for`, `repr()`), not by its name. The exception is
      // an `__init__` written by hand, which is the constructor. The one
      // `@dataclass` writes has no source line, so no place for a docstring.
      const constructor =
        object.name === "__init__" && (object.lineno ?? 0) > 0;
      const plumbing =
        object.is_special && !constructor && docOf(object).summary === "";
      if (name !== undefined && !plumbing) {
        owners.add(parentOf(name));
        symbols.push({ ...base, ...callable(object, name) });
      }
    } else if (object.kind === "class" && hasFields(path)) {
      symbols.push({
        ...base,
        kind: "type",
        properties: [...fieldsOf(path).values()],
      });
    } else if (object.kind === "attribute" && owner?.kind === "class") {
      const annotation = object.annotation ?? null;
      symbols.push({
        ...base,
        kind: "property",
        title: object.name,
        ...(annotation === null
          ? {}
          : { type: typeOf(annotation, parentOf(path)) }),
        // A field without a default has to be passed to the constructor.
        required: object.value === undefined || object.value === null,
        description: unwrap(docOf(object).description),
      });
    }
  }

  // A key that names no class would change nothing, without a word.
  const unknown = Object.keys(options.symbolPaths ?? {})
    .filter((path) => !owners.has(path))
    .sort();
  if (unknown.length > 0) {
    throw new GeneratorError(
      "symbolPaths names what is not the import path of a class with public methods:",
      unknown,
    );
  }
  return { language: "python", symbols };
}
