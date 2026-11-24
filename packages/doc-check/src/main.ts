import { parseArgs } from "node:util";
import {
  type CheckResult,
  checkDirectory,
  compileSchema,
  type Problem,
  type SchemaValidator,
} from "./check.ts";
import { readSchema, SchemaError, type SchemaSource } from "./schema.ts";

export interface Output {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

const USAGE = `Usage: doc-check <definitions-directory> [schema]

Checks every *.md definition in the directory against the docs schema.

The schema is the copy bundled with this package, or one of:
  --schema-url <url>          a schema file served over HTTP or HTTPS
  --schema-git <repository>   a schema file in a Git repository, with
    --schema-ref <ref>          a branch, a tag or a full commit SHA
    --schema-path <path>        the path of the file in the repository

Exit codes:
  0  every definition matches the schema
  1  a definition is invalid, or the directory has none
  2  the check could not run: bad arguments, or the directory or the schema
     could not be read
`;

/** What the arguments ask for, or what is wrong with them. */
export type Arguments =
  | { readonly help: true }
  | { readonly error: string }
  | { readonly directory: string; readonly schema: SchemaSource };

const isHttpUrl = (text: string): boolean => {
  try {
    return ["http:", "https:"].includes(new URL(text).protocol);
  } catch {
    return false;
  }
};

/** Reads the command line. Pure: nothing is fetched or opened here. */
export function parseArguments(args: readonly string[]): Arguments {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...args],
      allowPositionals: true,
      options: {
        help: { type: "boolean", short: "h" },
        "schema-url": { type: "string" },
        "schema-git": { type: "string" },
        "schema-ref": { type: "string" },
        "schema-path": { type: "string" },
      },
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  const { values, positionals } = parsed;
  if (values.help) {
    return { help: true };
  }
  const [directory, ...extra] = positionals;
  if (directory === undefined || extra.length > 0) {
    return { error: "Give one definitions directory." };
  }

  const url = values["schema-url"];
  const git = [
    values["schema-git"],
    values["schema-ref"],
    values["schema-path"],
  ];
  const [repository, ref, path] = git;
  if (git.every((value) => value === undefined)) {
    if (url === undefined) {
      return { directory, schema: { kind: "bundled" } };
    }
    return isHttpUrl(url)
      ? { directory, schema: { kind: "url", url } }
      : { error: `--schema-url must be an http or https URL, not ${url}` };
  }
  if (url !== undefined) {
    return { error: "Give --schema-url or --schema-git, not both." };
  }
  if (repository === undefined || ref === undefined || path === undefined) {
    return {
      error: "--schema-git, --schema-ref and --schema-path go together.",
    };
  }
  return { directory, schema: { kind: "git", repository, ref, path } };
}

/** Groups problems by file, in the order they were found. */
export function formatProblems(problems: readonly Problem[]): string {
  const byFile = new Map<string, Problem[]>();
  for (const problem of problems) {
    const list = byFile.get(problem.file) ?? [];
    list.push(problem);
    byFile.set(problem.file, list);
  }
  return [...byFile]
    .map(([file, list]) =>
      [
        `✗ ${file || "(no files)"}`,
        ...list.map((problem) => `    ${problem.path} ${problem.message}`),
      ].join("\n"),
    )
    .join("\n");
}

const invalidFiles = (result: CheckResult): number =>
  new Set(result.problems.map((problem) => problem.file)).size;

/** A missing or unreadable folder, as Node reports it. */
const isFileSystemError = (error: unknown): error is NodeJS.ErrnoException =>
  error instanceof Error &&
  typeof (error as NodeJS.ErrnoException).code === "string";

/** Runs the command line and returns the exit code. */
export async function main(
  args: readonly string[],
  output: Output,
): Promise<number> {
  const parsed = parseArguments(args);
  if ("help" in parsed) {
    output.stdout(USAGE);
    return 0;
  }
  if ("error" in parsed) {
    output.stderr(`doc-check: ${parsed.error}\n\n${USAGE}`);
    return 2;
  }
  const { directory } = parsed;

  let description: string;
  let validate: SchemaValidator;
  try {
    const schema = await readSchema(parsed.schema);
    description = schema.description;
    validate = compileSchema(schema.text);
  } catch (error) {
    // A schema that is unavailable or unusable is expected. Anything else is
    // a bug and keeps its stack trace.
    if (!(error instanceof SchemaError)) {
      throw error;
    }
    output.stderr(`doc-check: ${error.message}\n`);
    return 2;
  }

  let result: CheckResult;
  try {
    result = checkDirectory(directory, validate);
  } catch (error) {
    if (!isFileSystemError(error)) {
      throw error;
    }
    output.stderr(`doc-check: cannot read ${directory}: ${error.message}\n`);
    return 2;
  }

  if (result.problems.length > 0) {
    output.stderr(`${formatProblems(result.problems)}\n\n`);
    output.stderr(
      result.files === 0
        ? `No definitions found in ${directory}\n`
        : `${invalidFiles(result)} of ${result.files} definitions do not match ${description}\n`,
    );
    return 1;
  }
  output.stdout(`All ${result.files} definitions match ${description}\n`);
  return 0;
}
