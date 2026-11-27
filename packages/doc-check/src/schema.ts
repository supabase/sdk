import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Where `schema/definition.schema.json` was copied from. The docs team owns
 * the schema; this package bundles a copy so that a check needs no network
 * and gives the same answer every time.
 */
export const BUNDLED_SCHEMA = {
  repository: "supabase/supabase",
  commit: "7fba2c37f6208acb7451cacee84c43daa28b6480",
  path: "apps/docs/content/reference-beta/definition.schema.json",
  sha256: "d35060c40714a97ccdee920b6a0b0cf14f950a651d50bb03807cfcd918d01e2d",
} as const;

/**
 * Which schema to check against.
 *
 * - `bundled`: the copy in this package. The default.
 * - `url`: a schema file served over HTTP or HTTPS.
 * - `git`: a schema file in a Git repository. `repository` is anything `git
 *   fetch` accepts, a local path included. `ref` is a branch, a tag or a full
 *   commit SHA. A commit always gives the same schema; a branch gives the
 *   schema of the day.
 */
export type SchemaSource =
  | { readonly kind: "bundled" }
  | { readonly kind: "url"; readonly url: string }
  | {
      readonly kind: "git";
      readonly repository: string;
      readonly ref: string;
      readonly path: string;
    };

export interface LoadedSchema {
  /** The schema file as it was read. */
  readonly text: string;
  /** Says which schema this is, for the report: "the schema at ...". */
  readonly description: string;
}

/**
 * The schema could not be read or used, so nothing was checked. That is not
 * the same as a definition being invalid, and the command line tells the two
 * apart by exit code.
 */
export class SchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaError";
  }
}

/** Long enough for a slow network, short enough that CI does not hang. */
const TIMEOUT_MS = 60_000;

// `src/` and `dist/` both sit one level below the package root.
const BUNDLED_URL = new URL(
  "../schema/definition.schema.json",
  import.meta.url,
);

/** The bundled schema file, byte for byte. */
export const readBundledSchema = (): string =>
  readFileSync(BUNDLED_URL, "utf8");

const reasonOf = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return String(error);
  }
  // `fetch` reports "fetch failed" and keeps what went wrong in the cause.
  const cause = error.cause instanceof Error ? `: ${error.cause.message}` : "";
  return `${error.message}${cause}`;
};

async function readUrl(url: string): Promise<LoadedSchema> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    throw new SchemaError(`Cannot fetch ${url}: ${reasonOf(error)}`);
  }
  if (!response.ok) {
    throw new SchemaError(`Cannot fetch ${url}: HTTP ${response.status}`);
  }
  return {
    text: await response.text(),
    description: `the schema at ${url}`,
  };
}

/**
 * Variables that point Git at a repository. Git sets them for a hook, so a
 * check that runs from a pre-commit hook would otherwise fetch into the
 * repository being committed to instead of the temporary one.
 */
const REPOSITORY_VARIABLES = [
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_COMMON_DIR",
  "GIT_DIR",
  "GIT_INDEX_FILE",
  "GIT_NAMESPACE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_PREFIX",
  "GIT_WORK_TREE",
];

type Environment = Readonly<Record<string, string | undefined>>;

function gitEnvironment(environment: Environment): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = { ...environment };
  for (const name of REPOSITORY_VARIABLES) {
    delete result[name];
  }
  // Fail on a repository that needs a password instead of waiting for one.
  result.GIT_TERMINAL_PROMPT = "0";
  return result;
}

/** What Git said went wrong: the last line of its error output. */
const gitReason = (error: unknown): string => {
  const failure = error as { code?: string; stderr?: string | Buffer };
  if (failure.code === "ENOENT") {
    return "git is not installed";
  }
  const lines = String(failure.stderr ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.at(-1)?.replace(/^(fatal|error): /, "") ?? reasonOf(error);
};

function readGit(
  source: Extract<SchemaSource, { kind: "git" }>,
  environment: Environment,
): LoadedSchema {
  const { ref, path } = source;
  const where = `${path} at ${ref} of ${source.repository}`;
  for (const value of [source.repository, ref, path]) {
    // Git would read it as an option of its own.
    if (value.startsWith("-")) {
      throw new SchemaError(`Cannot read ${where}: "${value}" starts with -`);
    }
  }
  // A relative path would otherwise be resolved from the temporary folder.
  const repository = existsSync(source.repository)
    ? resolve(source.repository)
    : source.repository;

  const directory = mkdtempSync(join(tmpdir(), "doc-check-schema-"));
  const git = (...args: string[]): string =>
    execFileSync("git", args, {
      encoding: "utf8",
      env: gitEnvironment(environment),
      stdio: ["ignore", "pipe", "pipe"],
      timeout: TIMEOUT_MS,
    });
  try {
    git("init", "--bare", "--quiet", directory);
    git("--git-dir", directory, "remote", "add", "origin", repository);
    // One commit, and none of its files: `show` below then fetches the one
    // file that is asked for. The docs repository is large; this is not.
    git(
      "--git-dir",
      directory,
      "fetch",
      "--quiet",
      "--depth",
      "1",
      "--no-tags",
      "--filter=blob:none",
      "origin",
      ref,
    );
    const commit = git("--git-dir", directory, "rev-parse", "FETCH_HEAD");
    const text = git("--git-dir", directory, "show", `FETCH_HEAD:${path}`);
    return {
      text,
      // A branch moves. The commit says what was checked against today.
      description: `the schema at ${source.repository}@${commit.trim()}`,
    };
  } catch (error) {
    throw new SchemaError(`Cannot read ${where}: ${gitReason(error)}`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/**
 * Reads the schema a source names. Throws a `SchemaError` when it cannot be
 * read. `environment` is what `git` runs with; the default is this process's.
 */
export async function readSchema(
  source: SchemaSource,
  environment: Environment = process.env,
): Promise<LoadedSchema> {
  switch (source.kind) {
    case "bundled":
      return {
        text: readBundledSchema(),
        description: `the bundled schema (${BUNDLED_SCHEMA.repository}@${BUNDLED_SCHEMA.commit.slice(0, 7)})`,
      };
    case "url":
      return await readUrl(source.url);
    case "git":
      return readGit(source, environment);
  }
}
