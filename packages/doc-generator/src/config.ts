import { GeneratorError } from "./errors.ts";

/** Symbol graphs emitted by the Swift compiler. */
export interface SwiftSymbolGraphSource {
  readonly format: "swift-symbol-graph";
  /** Folder with the `*.symbols.json` files of one build. */
  readonly directory: string;
  /**
   * The modules to document. A build also emits a graph for every
   * dependency; only the modules named here are read.
   */
  readonly modules: readonly string[];
}

/** The JSON that `griffe dump` writes for Python packages. */
export interface GriffeSource {
  readonly format: "griffe";
  /**
   * The file `griffe dump --full --docstyle google` wrote. The docstrings
   * are in Google style, which the SDK repository enforces.
   */
  readonly file: string;
  /**
   * Canonical paths of generic wrapper types to see through in return types:
   * a method declared to return `Wrapper[T]` is documented as returning `T`,
   * with an awaitable form next to it. For methods that are declared once and
   * run on both a sync and an async client.
   */
  readonly unwrapReturns?: readonly string[];
  /**
   * How a user reaches the methods of a class, by the import path of the
   * class: `{ "supabase_auth.SyncAuthClient": "supabase.auth" }` documents
   * `sign_up` as `supabase.auth.sign_up`. A class that is not listed is
   * documented under its import path. Only the `symbol` of a definition
   * changes. Its id stays the import path.
   */
  readonly symbolPaths?: Readonly<Record<string, string>>;
}

export type SourceConfig = SwiftSymbolGraphSource | GriffeSource;

/**
 * How the SDK shows up on the docs site. Only `doc-generator preview` reads
 * it, to put the definitions where a local checkout of the docs site looks
 * for them.
 */
export interface PreviewConfig {
  /**
   * Where the docs site mounts the SDK, below its reference pages: `swift`
   * is served at `/docs/reference-beta/swift`.
   */
  readonly path: string;
  /**
   * The name of the SDK on the docs site. Used for the placeholder
   * introduction page that a preview writes when the checkout has none.
   */
  readonly title: string;
}

/**
 * What an SDK repository tells the generator. Paths are relative to the
 * config file. The config is data only: everything the generator does with
 * it lives, tested, in this package.
 */
export interface Config {
  /** Where the SDK's API comes from, and in which doc format. */
  readonly source: SourceConfig;
  /** The folder the definition files are written to. */
  readonly output: string;
  /**
   * Functions to leave out: regular expressions matched against the name a
   * definition id is made from, such as `AuthClient.signUp`. Default: every
   * public function gets a definition.
   */
  readonly exclude?: readonly string[];
  /**
   * Whether a public function without a doc comment is an error. Default:
   * it gets a definition with an empty summary, and is counted in the
   * report. With `true`, or `doc-generator --strict`, a run fails until
   * every public function has a doc comment or is named in `exclude`, so a
   * new one cannot be added without documenting it.
   */
  readonly strict?: boolean;
  /** Needed by `doc-generator preview` only. */
  readonly preview?: PreviewConfig;
}

/** Types a config in a `doc-generator.config.mjs` file. */
export const defineConfig = (config: Config): Config => config;

type Reader = (value: unknown, path: string, problems: string[]) => unknown;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const string: Reader = (value, path, problems) => {
  if (typeof value !== "string" || value === "") {
    problems.push(`${path} must be a non-empty string`);
  }
  return value;
};

const boolean: Reader = (value, path, problems) => {
  if (typeof value !== "boolean") {
    problems.push(`${path} must be true or false`);
  }
  return value;
};

const strings: Reader = (value, path, problems) => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    problems.push(`${path} must be a list of strings`);
  }
  return value;
};

const patterns: Reader = (value, path, problems) => {
  strings(value, path, problems);
  for (const pattern of Array.isArray(value) ? value : []) {
    try {
      new RegExp(String(pattern));
    } catch {
      problems.push(`${path}: ${String(pattern)} is not a regular expression`);
    }
  }
  return value;
};

/** What the docs site accepts as one segment of a URL below its pages. */
const MOUNT_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const mountPath: Reader = (value, path, problems) => {
  const safe =
    typeof value === "string" &&
    value
      .split("/")
      .every((part) => MOUNT_SEGMENT.test(part) && !part.includes(".."));
  if (!safe) {
    problems.push(
      `${path} must be a path of plain names, such as swift or swift/v3`,
    );
  }
  return value;
};

const stringMap: Reader = (value, path, problems) => {
  if (
    !isRecord(value) ||
    Object.values(value).some((item) => typeof item !== "string")
  ) {
    problems.push(`${path} must map names to strings`);
  }
  return value;
};

interface Field {
  readonly read: Reader;
  readonly required: boolean;
}

const required = (read: Reader): Field => ({ read, required: true });
const optional = (read: Reader): Field => ({ read, required: false });

/**
 * Reads an object with exactly the given fields. A key that is not listed is
 * a problem: it is nearly always a typo, and a typo in an optional key would
 * otherwise change the output without a word.
 */
function object(
  fields: Readonly<Record<string, Field>>,
  value: unknown,
  path: string,
  problems: string[],
): void {
  if (!isRecord(value)) {
    problems.push(`${path || "The config"} must be an object`);
    return;
  }
  const at = (key: string): string => (path === "" ? key : `${path}.${key}`);
  for (const key of Object.keys(value)) {
    if (!(key in fields)) {
      problems.push(`${at(key)} is not a known option`);
    }
  }
  for (const [key, field] of Object.entries(fields)) {
    if (value[key] !== undefined) {
      field.read(value[key], at(key), problems);
    } else if (field.required) {
      problems.push(`${at(key)} is required`);
    }
  }
}

const SOURCES: Readonly<Record<string, Readonly<Record<string, Field>>>> = {
  "swift-symbol-graph": {
    format: required(string),
    directory: required(string),
    modules: required(strings),
  },
  griffe: {
    format: required(string),
    file: required(string),
    unwrapReturns: optional(strings),
    symbolPaths: optional(stringMap),
  },
};

const preview: Reader = (value, path, problems) => {
  object(
    { path: required(mountPath), title: required(string) },
    value,
    path,
    problems,
  );
  return value;
};

const source: Reader = (value, path, problems) => {
  const format = isRecord(value) ? value.format : undefined;
  const fields = typeof format === "string" ? SOURCES[format] : undefined;
  if (fields === undefined) {
    const known = Object.keys(SOURCES).join(", ");
    problems.push(`${path}.format must be one of: ${known}`);
  } else {
    object(fields, value, path, problems);
  }
  return value;
};

/**
 * Checks a config once, here, so the rest of the generator works with a
 * `Config` it can trust. Throws a `GeneratorError` that lists every problem.
 */
export function parseConfig(value: unknown): Config {
  const problems: string[] = [];
  object(
    {
      source: required(source),
      output: required(string),
      exclude: optional(patterns),
      strict: optional(boolean),
      preview: optional(preview),
    },
    value,
    "",
    problems,
  );
  if (problems.length > 0) {
    throw new GeneratorError("The config is invalid:", problems);
  }
  return value as Config;
}
