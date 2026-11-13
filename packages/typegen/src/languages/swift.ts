import { existsSync } from "node:fs";
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";
import type {
  ChoiceOptionSpec,
  Host,
  SpawnRequest,
  SpawnResult,
  TypegenLanguage,
} from "../contract.ts";
import {
  ToolFailedError,
  ToolNotInstalledError,
  TypegenError,
} from "../errors.ts";
import { resolveOptions } from "../options.ts";
import { externalLanguage, isCommandNotFound } from "./external.ts";

const SWIFT_ACCESS_CONTROL = "swift-access-control";
const BINARY = "supabase-typegen";
const SOURCE = "https://github.com/supabase/supabase-swift";
const REPOSITORY = /github\.com[/:]supabase\/supabase-swift(\.git)?\/?$/i;
const PACKAGE_PATH = "tools/supabase-typegen";
const TOOLCHAIN = "Swift 6.2 / Xcode 26";
const FIRST_RELEASE = "3.0.0-alpha.1";
/** The only revision form ever passed to git, so a pin cannot smuggle in an option. */
const COMMIT = /^[0-9a-f]{40}$/;
/** Semantic versions only: a pinned version reaches git as a tag name and the terminal as text. */
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
/** Branch names git accepts, minus anything that could read as an option or a refspec. */
const BRANCH = /^(?!-)(?!.*\.\.)[A-Za-z0-9._/-]+$/;

/**
 * The flag `supabase gen types` already exposes, narrowed to the two levels
 * `supabase-typegen` accepts. The in-process generator it replaces also took
 * `private` and `package`; those now fail validation before anything runs.
 */
const swiftAccessControl = {
  name: SWIFT_ACCESS_CONTROL,
  audience: "user",
  kind: "choice",
  choices: ["internal", "public"],
  default: "internal",
  help: "Access control for Swift generated types.",
} satisfies ChoiceOptionSpec;

const installHint = `Install git and ${TOOLCHAIN} or newer so \`${BINARY}\` can be built from the supabase-swift commit your project pins, or set SUPABASE_TYPEGEN to a \`${BINARY}\` binary, or put one on PATH.`;

export interface SwiftDependencies {
  /** `process.platform`. Windows skips the source build. */
  readonly platform: string;
  /** Where the source build makes its scratch checkout. */
  readonly temporaryDirectory: () => string;
  /** Progress the user should see while the generator builds. */
  readonly log: (message: string) => void;
  /**
   * `process.getuid()`. A `Package.resolved` owned by anyone else is ignored,
   * so another user's file in a shared parent such as `/tmp` cannot pick the
   * commit that gets built. `undefined` skips the check.
   */
  readonly userId: () => number | undefined;
}

/**
 * Swift runs `supabase-typegen` from supabase-swift, which reads the document
 * on stdin and writes one file of `@Table` structs to stdout.
 *
 * The generated code targets the `@Table` macro of one supabase-swift
 * commit, so the generator must come from the same commit as the project's
 * dependency. The entry reads that commit from the nearest `Package.resolved`
 * (SwiftPM, or Xcode's copy inside the `.xcodeproj` or `.xcworkspace`),
 * builds the generator there from source once with the user's own `git` and
 * `swift`, caches the binary per commit and runs it. Without a supabase-swift
 * pin, or on Windows, it runs `supabase-typegen` from PATH.
 * `SUPABASE_TYPEGEN` overrides both.
 *
 * A source build trusts nothing beyond what the app already runs: the
 * supabase-swift source at the pinned commit, the generator's committed
 * `Package.resolved`, and the user's toolchain. GitHub serves every commit of
 * the fork network, pull request heads included, through the upstream URL, so
 * the commit must first be shown to be upstream's: a version pin's tag must
 * point at it, and any other pin must be on its upstream branch. It is a separate executable,
 * not a package dependency, because its swift-format dependency would pin
 * every app's swift-syntax, and because an Xcode project without a
 * `Package.swift` has nothing to `swift run` from. No `--schema` is passed:
 * the document already holds exactly the schemas the consumer introspected,
 * and the tool generates all of them.
 */
export function createSwift(
  dependencies: SwiftDependencies = {
    platform: process.platform,
    temporaryDirectory: tmpdir,
    log: (message) => process.stderr.write(`${message}\n`),
    userId: () => process.getuid?.(),
  },
): TypegenLanguage {
  const options = [swiftAccessControl];
  return {
    name: "swift",
    inProcess: false,
    options,
    async generate(metadata, values, host) {
      resolveOptions("swift", options, values);
      const command = await resolveBinary(host, dependencies);
      return externalLanguage("swift", options, {
        command,
        args: (_metadata, resolved) => [
          "--access-control",
          resolved[SWIFT_ACCESS_CONTROL] as string,
        ],
        installHint,
        classify: (result) =>
          result.exitCode === 65 ? { kind: "metadata-rejected" } : undefined,
      }).generate(metadata, values, host);
    },
  };
}

export const swift = createSwift();

async function resolveBinary(
  host: Host,
  dependencies: SwiftDependencies,
): Promise<string> {
  const override = host.env.SUPABASE_TYPEGEN;
  if (override) {
    return override;
  }
  const { spawn } = host;
  // Without spawn, externalLanguage reports SpawnUnavailableError for the generator itself.
  if (dependencies.platform === "win32" || spawn === undefined) {
    return BINARY;
  }
  const pin = await pinnedState(host.cwd, dependencies.userId());
  if (pin?.revision === undefined) {
    return BINARY;
  }
  const { revision, version, branch } = pin;
  const invalid = (field: string, value: string, expected: string) =>
    new TypegenError({
      language: "swift",
      message: `The supabase-swift pin in ${host.cwd}'s Package.resolved has ${field} ${JSON.stringify(value)}, which is not ${expected}. Resolve the package again, or: ${installHint}`,
    });
  if (!COMMIT.test(revision)) {
    throw invalid(
      "revision",
      revision,
      "a 40-character lowercase hex commit SHA",
    );
  }
  if (version !== undefined && !VERSION.test(version)) {
    throw invalid("version", version, "a semantic version");
  }
  if (version === undefined && branch !== undefined && !BRANCH.test(branch)) {
    throw invalid("branch", branch, "a plain branch name");
  }
  const path = join(
    cacheDirectory(host.env, dependencies.platform),
    revision,
    BINARY,
  );
  if (!existsSync(path)) {
    await build({
      host,
      spawn,
      dependencies,
      pin: { revision, version, branch },
      path,
    });
  }
  return path;
}

interface Build {
  readonly host: Host;
  readonly spawn: NonNullable<Host["spawn"]>;
  readonly dependencies: SwiftDependencies;
  /** A validated pin: the revision is a SHA, the version a semantic version, the branch plain. */
  readonly pin: { readonly revision: string } & PinState;
  /** Where the finished binary goes in the cache. */
  readonly path: string;
}

/**
 * Checks that `pin.revision` is upstream's, checks it out into a scratch
 * folder, builds the generator with its committed dependency versions and
 * moves the binary to `path`. The scratch folder is removed whatever happens,
 * and the cache only ever receives a binary that built and, for a version pin,
 * reports that version.
 */
async function build({
  host,
  spawn,
  dependencies,
  pin,
  path,
}: Build): Promise<void> {
  const { revision, version, branch } = pin;
  const label = version ?? revision;
  const exec = async (
    command: string,
    args: readonly string[],
    cwd: string,
  ): Promise<SpawnResult> => {
    const request: SpawnRequest = {
      command,
      args,
      cwd,
      env: buildEnvironment(host.env),
      stdin: "",
      signal: host.signal,
    };
    try {
      return await spawn(request);
    } catch (error) {
      if (isCommandNotFound(error)) {
        throw new ToolNotInstalledError({
          language: "swift",
          tool: command,
          installHint,
          message: `Building \`${BINARY}\` ${label} from source needs \`${command}\` and ${TOOLCHAIN} or newer, and \`${command}\` was not found on PATH. ${installHint}`,
          cause: error,
        });
      }
      throw error;
    }
  };
  const run = async (
    command: string,
    args: readonly string[],
    cwd: string,
  ): Promise<SpawnResult> => {
    const result = await exec(command, args, cwd);
    if (result.exitCode !== 0) {
      const commandLine = [command, ...args];
      const output = [result.stdout.trim(), result.stderr.trim()]
        .filter(Boolean)
        .join("\n");
      throw new ToolFailedError({
        language: "swift",
        command: commandLine,
        exitCode: result.exitCode,
        stderr: result.stderr.trim(),
        message: `Building \`${BINARY}\` ${label} from source failed: \`${commandLine.join(" ")}\` ${
          result.exitCode === null
            ? "was terminated by a signal"
            : `exited with code ${result.exitCode}`
        }.${output ? `\n${output}` : ""}`,
      });
    }
    return result;
  };

  await run("git", ["--version"], host.cwd);
  await run("swift", ["--version"], host.cwd);
  dependencies.log(
    `Building ${BINARY} ${label} from source (supabase-swift ${revision}). This takes a few minutes; later runs use the cached build.`,
  );
  const scratch = await mkdtemp(
    join(dependencies.temporaryDirectory(), `${BINARY}-`),
  );
  // Named after the scratch folder, which is unique, so concurrent runs never share one.
  const partial = `${path}.${process.pid}.${basename(scratch)}.partial`;
  const checkout = join(scratch, "src");
  try {
    if (version !== undefined) {
      // A tag can only come from upstream's maintainers; annotated tags list the commit as `^{}`.
      const tags = [version, `v${version}`].map((name) => `refs/tags/${name}`);
      const listed = await run(
        "git",
        ["ls-remote", SOURCE, ...tags.flatMap((tag) => [tag, `${tag}^{}`])],
        scratch,
      );
      const commits = new Map(
        listed.stdout
          .split("\n")
          .map((line) => line.split("\t"))
          .map(([sha, ref]) => [ref?.trim(), sha?.trim()]),
      );
      if (
        !tags.some(
          (tag) => (commits.get(`${tag}^{}`) ?? commits.get(tag)) === revision,
        )
      ) {
        throw new TypegenError({
          language: "swift",
          message: `supabase-swift's ${version} tag does not point at ${revision}, the revision Package.resolved pins. Resolve the package again; a revision from a fork or a pull request is not built.`,
        });
      }
    } else {
      // Only the commits of one branch, about 1.5 MB, to show the revision is on it.
      const branchArgs = branch === undefined ? [] : ["--branch", branch];
      await run(
        "git",
        [
          "clone",
          "--bare",
          "--filter=tree:0",
          "--no-tags",
          "--single-branch",
          ...branchArgs,
          SOURCE,
          "history.git",
        ],
        scratch,
      );
      const ancestry = await exec(
        "git",
        ["merge-base", "--is-ancestor", revision, "HEAD"],
        join(scratch, "history.git"),
      );
      if (ancestry.exitCode !== 0) {
        throw new TypegenError({
          language: "swift",
          message: `${revision} is not on supabase-swift's ${branch ?? "default"} branch. Resolve the package again; a revision from a fork or a pull request is not built.`,
        });
      }
    }
    await mkdir(checkout);
    await run("git", ["init"], checkout);
    await run("git", ["fetch", "--depth", "1", SOURCE, revision], checkout);
    await run("git", ["checkout", "--detach", "FETCH_HEAD"], checkout);
    const head = (await run("git", ["rev-parse", "HEAD"], checkout)).stdout;
    if (head.trim() !== revision) {
      throw new TypegenError({
        language: "swift",
        message: `Fetching supabase-swift ${revision} checked out ${head.trim()} instead.`,
      });
    }
    if (!existsSync(join(checkout, PACKAGE_PATH, "Package.swift"))) {
      throw new ToolNotInstalledError({
        language: "swift",
        tool: BINARY,
        installHint: `Update supabase-swift to ${FIRST_RELEASE} or newer.`,
        message: `supabase-swift ${label} has no ${BINARY}; update to ${FIRST_RELEASE} or newer.`,
      });
    }
    // --disable-automatic-resolution builds the committed Package.resolved exactly, or fails.
    // On Linux the binary would otherwise load the Swift runtime from the toolchain that
    // built it, and break for good once that toolchain is removed or upgraded.
    await run(
      "swift",
      [
        "build",
        "-c",
        "release",
        "--package-path",
        PACKAGE_PATH,
        "--disable-automatic-resolution",
        ...(dependencies.platform === "linux" ? ["--static-swift-stdlib"] : []),
      ],
      checkout,
    );
    const built = join(checkout, PACKAGE_PATH, ".build", "release", BINARY);
    if (version !== undefined) {
      const reported = (
        await run(built, ["--version"], checkout)
      ).stdout.trim();
      if (reported !== version) {
        throw new TypegenError({
          language: "swift",
          message: `The \`${BINARY}\` built from supabase-swift ${revision} reports version ${reported}, but Package.resolved pins ${version}.`,
        });
      }
    }
    // Copied beside the target and renamed, so a concurrent run never sees a partial file.
    await mkdir(dirname(path), { recursive: true });
    await copyFile(built, partial);
    await chmod(partial, 0o755);
    await rename(partial, path);
  } finally {
    await rm(partial, { force: true });
    await rm(scratch, { recursive: true, force: true });
  }
}

/**
 * What git exports to hooks, from `git rev-parse --local-env-vars`. Inherited,
 * they would point the scratch checkout, and SwiftPM's own git calls, at the
 * user's repository. `undefined` removes a variable even from a host that
 * merges `process.env` in, since Node and Bun skip undefined values.
 */
const GIT_REPOSITORY_VARIABLES = [
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_COMMON_DIR",
  "GIT_CONFIG",
  "GIT_CONFIG_COUNT",
  "GIT_CONFIG_PARAMETERS",
  "GIT_DIR",
  "GIT_GRAFT_FILE",
  "GIT_IMPLICIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_NO_REPLACE_OBJECTS",
  "GIT_OBJECT_DIRECTORY",
  "GIT_PREFIX",
  "GIT_REPLACE_REF_BASE",
  "GIT_SHALLOW_FILE",
  "GIT_WORK_TREE",
];

function buildEnvironment(
  env: Readonly<Record<string, string | undefined>>,
): Record<string, string | undefined> {
  return {
    ...env,
    ...Object.fromEntries(
      GIT_REPOSITORY_VARIABLES.map((name) => [name, undefined]),
    ),
    // A credential prompt would hang the CLI; the repository is public.
    GIT_TERMINAL_PROMPT: "0",
  };
}

/** Relative or empty values are ignored, as the XDG base directory spec asks. */
function cacheDirectory(
  env: Readonly<Record<string, string | undefined>>,
  platform: string,
): string {
  const absolute = (path: string | undefined) =>
    path && isAbsolute(path) ? path : undefined;
  const base =
    absolute(env.XDG_CACHE_HOME) ??
    join(
      absolute(env.HOME) ?? homedir(),
      platform === "darwin" ? "Library/Caches" : ".cache",
    );
  return join(base, "supabase", "typegen");
}

interface PinState {
  readonly version?: string;
  readonly branch?: string;
  readonly revision?: string;
}

/**
 * The supabase-swift pin of the nearest `Package.resolved` that has one,
 * looking in `cwd` and then each parent. Only regular files that `userId`
 * owns count.
 */
async function pinnedState(
  cwd: string,
  userId: number | undefined,
): Promise<PinState | undefined> {
  for (let directory = cwd; ; directory = dirname(directory)) {
    for (const file of await resolvedFiles(directory, userId)) {
      const state = stateIn(await readFile(file, "utf8"));
      if (state) {
        return state;
      }
    }
    if (dirname(directory) === directory) {
      return undefined;
    }
  }
}

async function resolvedFiles(
  directory: string,
  userId: number | undefined,
): Promise<string[]> {
  const entries = await readdir(directory).catch(() => []);
  const candidates = [
    join(directory, "Package.resolved"),
    ...entries
      .filter((entry) => entry.endsWith(".xcworkspace"))
      .map((entry) =>
        join(directory, entry, "xcshareddata/swiftpm/Package.resolved"),
      ),
    ...entries
      .filter((entry) => entry.endsWith(".xcodeproj"))
      .map((entry) =>
        join(
          directory,
          entry,
          "project.xcworkspace/xcshareddata/swiftpm/Package.resolved",
        ),
      ),
  ];
  const usable = await Promise.all(
    candidates.map(async (file) => {
      const status = await stat(file).catch(() => undefined);
      // A FIFO would block the read forever; a file of another user is not the project's.
      return (
        status?.isFile() === true &&
        (userId === undefined || status.uid === userId)
      );
    }),
  );
  return candidates.filter((_file, index) => usable[index]);
}

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const text = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

/**
 * Reads every `Package.resolved` format (version 1 nests the pins under
 * `object`). Anything that is not the expected shape counts as no pin.
 */
function stateIn(contents: string): PinState | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    return undefined;
  }
  const root = record(parsed);
  const pins = root?.pins ?? record(root?.object)?.pins;
  if (!Array.isArray(pins)) {
    return undefined;
  }
  for (const entry of pins) {
    const pin = record(entry);
    const location = text(pin?.location) ?? text(pin?.repositoryURL) ?? "";
    if (REPOSITORY.test(location)) {
      const state = record(pin?.state);
      return {
        version: text(state?.version),
        branch: text(state?.branch),
        revision: text(state?.revision),
      };
    }
  }
  return undefined;
}
