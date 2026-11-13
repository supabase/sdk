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
 * `Package.resolved`, and the user's toolchain. It is a separate executable,
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
  const pin = await pinnedState(host.cwd);
  if (pin?.revision === undefined) {
    return BINARY;
  }
  const { revision, version } = pin;
  if (!COMMIT.test(revision)) {
    throw new TypegenError({
      language: "swift",
      message: `The supabase-swift pin in ${host.cwd}'s Package.resolved has revision "${revision}", which is not a 40-character lowercase hex commit SHA. Resolve the package again, or: ${installHint}`,
    });
  }
  const path = join(
    cacheDirectory(host.env, dependencies.platform),
    revision,
    BINARY,
  );
  if (!existsSync(path)) {
    await build({ host, spawn, dependencies, revision, version, path });
  }
  return path;
}

interface Build {
  readonly host: Host;
  readonly spawn: NonNullable<Host["spawn"]>;
  readonly dependencies: SwiftDependencies;
  readonly revision: string;
  readonly version: string | undefined;
  /** Where the finished binary goes in the cache. */
  readonly path: string;
}

/**
 * Checks out `revision` into a scratch folder, builds the generator with its
 * committed dependency versions and moves the binary to `path`. The scratch
 * folder is removed whatever happens, and the cache only ever receives a
 * binary that built and, for a version pin, reports that version.
 */
async function build({
  host,
  spawn,
  dependencies,
  revision,
  version,
  path,
}: Build): Promise<void> {
  const label = version ?? revision;
  const run = async (
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
    let result: SpawnResult;
    try {
      result = await spawn(request);
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
  try {
    await run("git", ["init"], scratch);
    await run("git", ["fetch", "--depth", "1", SOURCE, revision], scratch);
    await run("git", ["checkout", "--detach", "FETCH_HEAD"], scratch);
    const head = (await run("git", ["rev-parse", "HEAD"], scratch)).stdout;
    if (head.trim() !== revision) {
      throw new TypegenError({
        language: "swift",
        message: `Fetching supabase-swift ${revision} checked out ${head.trim()} instead.`,
      });
    }
    if (!existsSync(join(scratch, PACKAGE_PATH, "Package.swift"))) {
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
      scratch,
    );
    const built = join(scratch, PACKAGE_PATH, ".build", "release", BINARY);
    if (version !== undefined) {
      const reported = (await run(built, ["--version"], scratch)).stdout.trim();
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
  readonly revision?: string;
}

/**
 * The supabase-swift pin of the nearest `Package.resolved` that has one,
 * looking in `cwd` and then each parent.
 */
async function pinnedState(cwd: string): Promise<PinState | undefined> {
  for (let directory = cwd; ; directory = dirname(directory)) {
    for (const file of await resolvedFiles(directory)) {
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

async function resolvedFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory).catch(() => []);
  return [
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
  ].filter((file) => existsSync(file));
}

interface Pin {
  readonly location?: string;
  readonly repositoryURL?: string;
  readonly state?: PinState;
}

/** Reads every `Package.resolved` format: version 1 nests the pins under `object`. */
function stateIn(contents: string): PinState | undefined {
  let parsed: { pins?: Pin[]; object?: { pins?: Pin[] } };
  try {
    parsed = JSON.parse(contents);
  } catch {
    return undefined;
  }
  const pins = parsed.pins ?? parsed.object?.pins ?? [];
  return pins.find((pin) =>
    REPOSITORY.test(pin.location ?? pin.repositoryURL ?? ""),
  )?.state;
}
