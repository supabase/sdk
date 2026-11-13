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
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import type {
  ChoiceOptionSpec,
  Host,
  SpawnRequest,
  SpawnResult,
  StringOptionSpec,
  TypegenLanguage,
} from "../contract.ts";
import {
  InvalidOptionError,
  ToolFailedError,
  ToolNotInstalledError,
  TypegenError,
} from "../errors.ts";
import { resolveOptions } from "../options.ts";
import { externalLanguage, isCommandNotFound } from "./external.ts";

const SWIFT_ACCESS_CONTROL = "swift-access-control";
const SWIFT_TYPEGEN_SOURCE = "swift-typegen-source";
const BINARY = "supabase-typegen";
const SOURCE = "https://github.com/supabase/supabase-swift";
const REPOSITORY = /github\.com[/:]supabase\/supabase-swift(\.git)?\/?$/i;
const PACKAGE_PATH = "tools/supabase-typegen";
const TOOLCHAIN = "Swift 6.2 / Xcode 26";
const FIRST_RELEASE = "3.0.0-alpha.1";
/** The major version whose latest release is the default without a pin. */
const MAJOR = 3;
/** The only revision form ever passed to git, so a pin cannot smuggle in an option. */
const COMMIT = /^[0-9a-f]{40}$/;
/** Hex that could be an abbreviated commit; git abbreviates to 7 characters by default. */
const SHORT_COMMIT = /^[0-9a-f]{7,39}$/i;
/** Semantic versions only: a version reaches git as a tag name and the terminal as text. */
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
/** Branch names git accepts, minus anything that could read as an option or a refspec. */
const BRANCH = /^(?!-)(?!.*\.\.)[A-Za-z0-9._/-]+$/;
/** How far below `cwd` a monorepo's lockfiles are searched when no parent has one. */
const SEARCH_DEPTH = 2;
/** Folders that hold dependencies, build output or history, never an app's lockfile. */
const SKIPPED_FOLDERS = new Set([
  ".git",
  ".build",
  "node_modules",
  "Pods",
  "DerivedData",
]);

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

/** Which supabase-swift source `supabase-typegen` is built from. */
const swiftTypegenSource = {
  name: SWIFT_TYPEGEN_SOURCE,
  audience: "user",
  kind: "string",
  help: "Where to build supabase-typegen from: a supabase-swift version (3.0.0-alpha.1), a branch (main), a full commit SHA, or a local checkout (./supabase-swift). Default: the supabase-swift pin in the nearest Package.resolved, else the latest 3.x release.",
} satisfies StringOptionSpec;

const installHint = `Install git and ${TOOLCHAIN} or newer, which build \`${BINARY}\` from supabase-swift's source. Pass --${SWIFT_TYPEGEN_SOURCE} to choose that source: a version, a branch, a full commit SHA or a local checkout.`;

export interface SwiftDependencies {
  /** `process.platform`. Windows is not supported. */
  readonly platform: string;
  /** Where the source build makes its scratch checkout and runs its lookups. */
  readonly temporaryDirectory: () => string;
  /** Progress the user should see while the generator is chosen and built. */
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
 * commit, so the generator is built from source at a supabase-swift commit
 * with the user's own `git` and `swift`, and cached per commit. The commit
 * is, in this order: the one `swift-typegen-source` names (a version, a
 * branch, a full SHA, or a local checkout built in place and never cached);
 * the supabase-swift pin of the nearest `Package.resolved` (SwiftPM, or
 * Xcode's copy inside the `.xcodeproj` or `.xcworkspace`), in `cwd`, a parent,
 * or up to two levels below `cwd`; or the latest 3.x release.
 *
 * A pinned build trusts nothing beyond what the app already runs: the
 * supabase-swift source at the pinned commit, the generator's committed
 * `Package.resolved`, and the user's toolchain. GitHub serves every commit of
 * the fork network, pull request heads included, through the upstream URL, so
 * a commit that did not come from upstream's own tags or branches must first
 * be shown to be upstream's: a version pin's tag must point at it, and any
 * other pin, or a SHA passed to `swift-typegen-source`, must be on its
 * upstream branch. It is a separate executable, not a package dependency,
 * because its swift-format dependency would pin every app's swift-syntax, and
 * because an Xcode project without a `Package.swift` has nothing to
 * `swift run` from. No `--schema` is passed: the document already holds
 * exactly the schemas the consumer introspected, and the tool generates all
 * of them.
 */
export function createSwift(
  dependencies: SwiftDependencies = {
    platform: process.platform,
    temporaryDirectory: tmpdir,
    log: (message) => process.stderr.write(`${message}\n`),
    userId: () => process.getuid?.(),
  },
): TypegenLanguage {
  const options = [swiftAccessControl, swiftTypegenSource];
  return {
    name: "swift",
    inProcess: false,
    options,
    async generate(metadata, values, host) {
      const resolved = resolveOptions("swift", options, values);
      const command = await resolveBinary(
        host,
        dependencies,
        resolved[SWIFT_TYPEGEN_SOURCE] as string | undefined,
      );
      return externalLanguage("swift", options, {
        command,
        args: (_metadata, resolvedOptions) => [
          "--access-control",
          resolvedOptions[SWIFT_ACCESS_CONTROL] as string,
        ],
        installHint,
        classify: (result) =>
          result.exitCode === 65 ? { kind: "metadata-rejected" } : undefined,
      }).generate(metadata, values, host);
    },
  };
}

export const swift = createSwift();

/** A value of `swift-typegen-source`, parsed without looking anything up. */
export type TypegenSource =
  | { readonly kind: "path"; readonly path: string }
  | { readonly kind: "commit"; readonly revision: string }
  | { readonly kind: "version"; readonly version: string }
  | { readonly kind: "branch"; readonly branch: string };

/**
 * Reads a `swift-typegen-source` value in a fixed order, without guessing: a
 * path starts with `./`, `../`, `/` or `~/` (so a folder named `3.0.0` is
 * never read as a version), a commit is 40 hex characters, a version is a
 * semantic version with or without a leading `v`, and anything else that is a
 * plain branch name is a branch. Throws an `InvalidOptionError` for an
 * abbreviated SHA, any other path form and anything git could read as an
 * option or a refspec.
 */
export function parseTypegenSource(
  value: string,
  base: { readonly cwd: string; readonly home: string },
): TypegenSource {
  const invalid = (reason: string) =>
    new InvalidOptionError({
      language: "swift",
      option: SWIFT_TYPEGEN_SOURCE,
      message: `--${SWIFT_TYPEGEN_SOURCE} ${printable(value)} ${reason}`,
    });
  if (/^[./~]/.test(value)) {
    if (value === "~" || value.startsWith("~/")) {
      return { kind: "path", path: join(base.home, value.slice(1)) };
    }
    if (
      value.startsWith("/") ||
      value === "." ||
      value === ".." ||
      value.startsWith("./") ||
      value.startsWith("../")
    ) {
      return { kind: "path", path: resolve(base.cwd, value) };
    }
    throw invalid(
      "is not a path this option reads. Start a relative path with ./ or ../, and a path in your home folder with ~/.",
    );
  }
  if (/^[0-9a-f]{40}$/i.test(value)) {
    return { kind: "commit", revision: value.toLowerCase() };
  }
  if (SHORT_COMMIT.test(value)) {
    throw invalid(
      "looks like an abbreviated commit SHA. Pass the full 40-character SHA.",
    );
  }
  const version = value.replace(/^v(?=\d)/, "");
  if (VERSION.test(version)) {
    return { kind: "version", version };
  }
  if (!BRANCH.test(value)) {
    throw invalid(
      "is not a version, a full commit SHA, a path starting with ./, ../, / or ~/, or a valid branch name.",
    );
  }
  return { kind: "branch", branch: value };
}

/**
 * `git ls-remote` output as ref name to commit. An annotated tag lists its
 * own object and, as `<ref>^{}`, the commit it points at; the commit wins.
 * Lines whose object is not a full SHA are dropped.
 */
export function parseRefs(listing: string): Map<string, string> {
  const refs = new Map<string, string>();
  const peeled = new Map<string, string>();
  for (const line of listing.split("\n")) {
    const [sha, ref] = line.split("\t").map((field) => field.trim());
    if (sha === undefined || ref === undefined || !COMMIT.test(sha)) {
      continue;
    }
    if (ref.endsWith("^{}")) {
      peeled.set(ref.slice(0, -3), sha);
    } else {
      refs.set(ref, sha);
    }
  }
  for (const [ref, sha] of peeled) {
    refs.set(ref, sha);
  }
  return refs;
}

interface SemanticVersion {
  readonly core: readonly [number, number, number];
  readonly prerelease: readonly string[];
}

const parseVersion = (version: string): SemanticVersion | undefined => {
  const match =
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(
      version,
    );
  if (!match) {
    return undefined;
  }
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4]?.split(".") ?? [],
  };
};

const compareIdentifiers = (a: string, b: string): number => {
  const numeric = /^\d+$/;
  if (numeric.test(a) && numeric.test(b)) {
    return Number(a) - Number(b);
  }
  if (numeric.test(a) !== numeric.test(b)) {
    return numeric.test(a) ? -1 : 1;
  }
  return a < b ? -1 : a > b ? 1 : 0;
};

/**
 * Semantic version precedence: negative when `a` comes before `b`. A
 * prerelease comes before its release, and prerelease identifiers compare
 * numerically when both are numbers, so `alpha.10` follows `alpha.9`. Build
 * metadata is ignored. Both arguments must be semantic versions.
 */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) {
    throw new RangeError(`Not semantic versions: ${a}, ${b}`);
  }
  for (const index of [0, 1, 2] as const) {
    const difference = left.core[index] - right.core[index];
    if (difference !== 0) {
      return difference;
    }
  }
  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    return right.prerelease.length - left.prerelease.length;
  }
  const shared = Math.min(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < shared; index++) {
    const difference = compareIdentifiers(
      left.prerelease[index] ?? "",
      right.prerelease[index] ?? "",
    );
    if (difference !== 0) {
      return difference;
    }
  }
  return left.prerelease.length - right.prerelease.length;
}

/**
 * The tag of the highest `major`.x release among `tags` (names with or
 * without a leading `v`): the highest stable release once there is one, the
 * highest prerelease before that. Never another major version.
 */
export function latestRelease(
  tags: readonly string[],
  major: number,
): { readonly tag: string; readonly version: string } | undefined {
  const releases = tags.flatMap((tag) => {
    const version = tag.replace(/^v(?=\d)/, "");
    const parsed = parseVersion(version);
    return parsed?.core[0] === major ? [{ tag, version, parsed }] : [];
  });
  const stable = releases.filter(
    (release) => release.parsed.prerelease.length === 0,
  );
  const candidates = stable.length > 0 ? stable : releases;
  let latest: (typeof candidates)[number] | undefined;
  for (const candidate of candidates) {
    if (
      latest === undefined ||
      compareVersions(candidate.version, latest.version) > 0
    ) {
      latest = candidate;
    }
  }
  return latest && { tag: latest.tag, version: latest.version };
}

/** The supabase-swift commit to build, already a 40-character lowercase hex SHA. */
interface Target {
  readonly revision: string;
  /** Set when a version was asked for; the built binary must report it. */
  readonly version?: string;
  /**
   * How to show the revision is upstream's before fetching it: the version
   * tag must point at it, or it must be on the branch (`undefined`: the
   * default branch). Absent when the revision came from upstream's own refs.
   */
  readonly provenance?:
    | { readonly kind: "tag"; readonly version: string }
    | { readonly kind: "branch"; readonly branch?: string };
}

/** The `git` and `swift` steps, which name the step and its tool when they fail. */
interface Runner {
  exec(
    command: string,
    args: readonly string[],
    cwd: string,
    step: string,
  ): Promise<SpawnResult>;
  /** Like `exec`, but a non-zero exit is a `ToolFailedError` with the tool's output. */
  run(
    command: string,
    args: readonly string[],
    cwd: string,
    step: string,
  ): Promise<SpawnResult>;
}

function createRunner(host: Host, spawn: NonNullable<Host["spawn"]>): Runner {
  const exec: Runner["exec"] = async (command, args, cwd, step) => {
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
          message: `${step} needs \`${command}\`, which was not found on PATH. ${installHint}`,
          cause: error,
        });
      }
      throw error;
    }
  };
  return {
    exec,
    async run(command, args, cwd, step) {
      const result = await exec(command, args, cwd, step);
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
          message: `${step} failed: \`${commandLine.join(" ")}\` ${
            result.exitCode === null
              ? "was terminated by a signal"
              : `exited with code ${result.exitCode}`
          }.${output ? `\n${output}` : ""}`,
        });
      }
      return result;
    },
  };
}

async function resolveBinary(
  host: Host,
  dependencies: SwiftDependencies,
  source: string | undefined,
): Promise<string> {
  const { spawn } = host;
  // Without spawn, externalLanguage reports SpawnUnavailableError for the generator itself.
  if (spawn === undefined) {
    return BINARY;
  }
  if (dependencies.platform === "win32") {
    throw new TypegenError({
      language: "swift",
      message: `Generating Swift types builds \`${BINARY}\` from supabase-swift's source, which is not supported on Windows. Run supabase gen types --lang swift on macOS or Linux.`,
    });
  }
  const runner = createRunner(host, spawn);
  let target: Target;
  if (source === undefined) {
    target = await defaultTarget(host, dependencies, runner);
  } else {
    const parsed = parseTypegenSource(source, {
      cwd: host.cwd,
      home: absolute(host.env.HOME) ?? homedir(),
    });
    if (parsed.kind === "path") {
      return await buildCheckout(parsed.path, dependencies, runner);
    }
    target = await chosenTarget(parsed, host, dependencies, runner);
  }
  const path = join(
    cacheDirectory(host.env, dependencies.platform),
    target.revision,
    BINARY,
  );
  if (!existsSync(path)) {
    await build({ host, dependencies, runner, target, path });
  }
  return path;
}

const abbreviated = (revision: string) => `\`${revision.slice(0, 7)}…\``;

/** Resolves a version, branch or commit from `swift-typegen-source` to a commit. */
async function chosenTarget(
  source: Exclude<TypegenSource, { readonly kind: "path" }>,
  host: Host,
  dependencies: SwiftDependencies,
  runner: Runner,
): Promise<Target> {
  const lookups = dependencies.temporaryDirectory();
  switch (source.kind) {
    case "commit":
      dependencies.log(`Using commit ${abbreviated(source.revision)}.`);
      return {
        revision: source.revision,
        provenance: { kind: "branch" },
      };
    case "version": {
      const { version } = source;
      if ((parseVersion(version)?.core[0] ?? 0) < MAJOR) {
        throw new InvalidOptionError({
          language: "swift",
          option: SWIFT_TYPEGEN_SOURCE,
          message: `supabase-swift ${version} has no ${BINARY}; pass ${FIRST_RELEASE} or newer to --${SWIFT_TYPEGEN_SOURCE}.`,
        });
      }
      const tags = [`v${version}`, version].map((name) => `refs/tags/${name}`);
      const listed = await runner.run(
        "git",
        ["ls-remote", SOURCE, ...tags.flatMap((tag) => [tag, `${tag}^{}`])],
        lookups,
        `Looking up supabase-swift's tag v${version}`,
      );
      const refs = parseRefs(listed.stdout);
      const revision = tags
        .map((tag) => refs.get(tag))
        .find((sha) => sha !== undefined);
      if (revision === undefined) {
        throw new TypegenError({
          language: "swift",
          message: `No tag named \`v${version}\` in supabase/supabase-swift (looked for ${tags.join(" and ")}).`,
        });
      }
      dependencies.log(
        `Using version \`${version}\` at ${abbreviated(revision)}.`,
      );
      return { revision, version };
    }
    case "branch": {
      const { branch } = source;
      const ref = `refs/heads/${branch}`;
      const listed = await runner.run(
        "git",
        ["ls-remote", SOURCE, ref],
        lookups,
        `Looking up supabase-swift's branch ${branch}`,
      );
      const revision = parseRefs(listed.stdout).get(ref);
      if (revision === undefined) {
        const folder = resolve(host.cwd, branch);
        throw new TypegenError({
          language: "swift",
          message: `No branch named \`${branch}\` in supabase/supabase-swift.${
            existsSync(folder)
              ? ` To build the local checkout at ${folder}, pass ./${branch}.`
              : ""
          }`,
        });
      }
      dependencies.log(
        `Using branch \`${branch}\` at ${abbreviated(revision)}.`,
      );
      return { revision };
    }
  }
}

/** The lockfile pin, or else the latest 3.x release with a notice. */
async function defaultTarget(
  host: Host,
  dependencies: SwiftDependencies,
  runner: Runner,
): Promise<Target> {
  const pin = await findPin(host.cwd, dependencies.userId());
  if (pin === undefined) {
    const listed = await runner.run(
      "git",
      ["ls-remote", "--tags", SOURCE],
      dependencies.temporaryDirectory(),
      "Looking up supabase-swift's releases",
    );
    const refs = parseRefs(listed.stdout);
    const prefix = "refs/tags/";
    const latest = latestRelease(
      [...refs.keys()]
        .filter((ref) => ref.startsWith(prefix))
        .map((ref) => ref.slice(prefix.length)),
      MAJOR,
    );
    const revision = latest && refs.get(`${prefix}${latest.tag}`);
    if (latest === undefined || revision === undefined) {
      throw new TypegenError({
        language: "swift",
        message: `No supabase-swift pin found from \`${host.cwd}\`, and supabase/supabase-swift has no ${MAJOR}.x release yet. Run from your app directory, or pass --${SWIFT_TYPEGEN_SOURCE}.`,
      });
    }
    dependencies.log(
      `No supabase-swift pin found from \`${host.cwd}\`. Using ${latest.version} (latest) at ${abbreviated(revision)}. Run from your app directory, or pass --${SWIFT_TYPEGEN_SOURCE}, to match your pinned version.`,
    );
    return { revision, version: latest.version };
  }
  const { revision, version, branch, file } = pin;
  const where = relative(host.cwd, file) || file;
  const invalid = (field: string, value: string, expected: string) =>
    new TypegenError({
      language: "swift",
      message: `The supabase-swift pin in ${where} has ${field} ${printable(value)}, which is not ${expected}. Resolve the package again, or pass --${SWIFT_TYPEGEN_SOURCE}.`,
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
  if (version !== undefined) {
    dependencies.log(
      `Using version \`${version}\` at ${abbreviated(revision)}, pinned in ${where}.`,
    );
    return { revision, version, provenance: { kind: "tag", version } };
  }
  dependencies.log(
    branch === undefined
      ? `Using commit ${abbreviated(revision)}, pinned in ${where}.`
      : `Using branch \`${branch}\` at ${abbreviated(revision)}, pinned in ${where}.`,
  );
  return { revision, provenance: { kind: "branch", branch } };
}

/**
 * Builds the generator in a local supabase-swift checkout, in its own
 * `.build` folder so later builds are incremental, and returns the binary
 * there. Never cached: the working tree can hold uncommitted changes.
 */
async function buildCheckout(
  checkout: string,
  dependencies: SwiftDependencies,
  runner: Runner,
): Promise<string> {
  const packagePath = join(checkout, PACKAGE_PATH);
  if (!existsSync(join(packagePath, "Package.swift"))) {
    throw new InvalidOptionError({
      language: "swift",
      option: SWIFT_TYPEGEN_SOURCE,
      message: `${checkout} has no ${PACKAGE_PATH}. Pass --${SWIFT_TYPEGEN_SOURCE} a checkout of supabase-swift ${FIRST_RELEASE} or newer.`,
    });
  }
  dependencies.log(
    `Using the local checkout ${checkout}, with any uncommitted changes. Building ${BINARY} there; the first build takes a few minutes, later ones rebuild only what changed.`,
  );
  await runner.run(
    "swift",
    ["build", "-c", "release", "--package-path", packagePath],
    checkout,
    `Building \`${BINARY}\` in ${checkout}`,
  );
  return join(packagePath, ".build", "release", BINARY);
}

interface Build {
  readonly host: Host;
  readonly dependencies: SwiftDependencies;
  readonly runner: Runner;
  readonly target: Target;
  /** Where the finished binary goes in the cache. */
  readonly path: string;
}

/**
 * Checks that `target.revision` is upstream's when it did not come from
 * upstream's refs, checks it out into a scratch folder, builds the generator
 * with its committed dependency versions and moves the binary to `path`. The
 * scratch folder is removed whatever happens, and the cache only ever
 * receives a binary that built and, for a version, reports that version.
 */
async function build({
  host,
  dependencies,
  runner,
  target,
  path,
}: Build): Promise<void> {
  const { revision, version, provenance } = target;
  const step = `Building \`${BINARY}\` ${version ?? revision} from source`;
  const run = (command: string, args: readonly string[], cwd: string) =>
    runner.run(command, args, cwd, step);

  await run("git", ["--version"], host.cwd);
  await run("swift", ["--version"], host.cwd);
  dependencies.log(
    `Building ${BINARY} ${version ?? revision} from source (supabase-swift ${revision}). This takes a few minutes; later runs use the cached build.`,
  );
  const scratch = await mkdtemp(
    join(dependencies.temporaryDirectory(), `${BINARY}-`),
  );
  // Named after the scratch folder, which is unique, so concurrent runs never share one.
  const partial = `${path}.${process.pid}.${basename(scratch)}.partial`;
  const checkout = join(scratch, "src");
  try {
    if (provenance?.kind === "tag") {
      // A tag can only come from upstream's maintainers; annotated tags list the commit as `^{}`.
      const tags = [provenance.version, `v${provenance.version}`].map(
        (name) => `refs/tags/${name}`,
      );
      const listed = await run(
        "git",
        ["ls-remote", SOURCE, ...tags.flatMap((tag) => [tag, `${tag}^{}`])],
        scratch,
      );
      const refs = parseRefs(listed.stdout);
      if (!tags.some((tag) => refs.get(tag) === revision)) {
        throw new TypegenError({
          language: "swift",
          message: `supabase-swift's ${provenance.version} tag does not point at ${revision}, the revision Package.resolved pins. Resolve the package again; a revision from a fork or a pull request is not built.`,
        });
      }
    } else if (provenance?.kind === "branch") {
      const { branch } = provenance;
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
      const ancestry = await runner.exec(
        "git",
        ["merge-base", "--is-ancestor", revision, "HEAD"],
        join(scratch, "history.git"),
        step,
      );
      if (ancestry.exitCode !== 0) {
        throw new TypegenError({
          language: "swift",
          message: `${revision} is not on supabase-swift's ${branch ?? "default"} branch, and a revision from a fork or a pull request is not built. Resolve the package again if the branch moved, or pass a local checkout to --${SWIFT_TYPEGEN_SOURCE}.`,
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
        message: `supabase-swift ${version ?? revision} has no ${BINARY}; update to ${FIRST_RELEASE} or newer.`,
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
          message: `The \`${BINARY}\` built from supabase-swift ${revision} reports version ${printable(reported)}, not ${version}.`,
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

const absolute = (path: string | undefined) =>
  path && isAbsolute(path) ? path : undefined;

/** Relative or empty values are ignored, as the XDG base directory spec asks. */
function cacheDirectory(
  env: Readonly<Record<string, string | undefined>>,
  platform: string,
): string {
  const base =
    absolute(env.XDG_CACHE_HOME) ??
    join(
      absolute(env.HOME) ?? homedir(),
      platform === "darwin" ? "Library/Caches" : ".cache",
    );
  return join(base, "supabase", "typegen");
}

/** A value for the terminal: quoted, with control characters escaped. */
const printable = (value: string): string =>
  JSON.stringify(value).replace(
    /[\u007f-\u009f]/g,
    (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );

interface Pin {
  readonly revision: string;
  readonly version?: string;
  readonly branch?: string;
  /** The `Package.resolved` it came from. */
  readonly file: string;
}

/**
 * The supabase-swift pin of the nearest `Package.resolved` that has one,
 * looking in `cwd` and then each parent. Without one there, a monorepo's
 * apps may sit below `cwd`, so it looks up to `SEARCH_DEPTH` levels down and
 * accepts what it finds only when every pin there agrees on the revision.
 * Only regular files that `userId` owns count.
 */
async function findPin(
  cwd: string,
  userId: number | undefined,
): Promise<Pin | undefined> {
  for (let directory = cwd; ; directory = dirname(directory)) {
    const [pin] = await pinsIn(directory, userId);
    if (pin) {
      return pin;
    }
    if (dirname(directory) === directory) {
      break;
    }
  }
  const pins: Pin[] = [];
  for (const directory of await foldersBelow(cwd)) {
    pins.push(...(await pinsIn(directory, userId)));
  }
  const revisions = new Set(pins.map((pin) => pin.revision));
  if (revisions.size > 1) {
    throw new TypegenError({
      language: "swift",
      message: `No supabase-swift pin found in \`${cwd}\` or its parents, and the Package.resolved files below it pin different supabase-swift revisions:\n${pins
        .map(
          (pin) => `  ${relative(cwd, pin.file)}: ${printable(pin.revision)}`,
        )
        .join(
          "\n",
        )}\nRun from your app directory, or pass --${SWIFT_TYPEGEN_SOURCE} to choose the source.`,
    });
  }
  return pins[0];
}

/** Folders up to `SEARCH_DEPTH` levels below `cwd`, in a stable order, without following links. */
async function foldersBelow(cwd: string): Promise<string[]> {
  const found: string[] = [];
  let level = [cwd];
  for (let depth = 0; depth < SEARCH_DEPTH; depth++) {
    const next: string[] = [];
    for (const directory of level) {
      const entries = await readdir(directory, { withFileTypes: true }).catch(
        () => [],
      );
      for (const entry of entries) {
        // Xcode's copies inside these bundles are read with their parent folder.
        if (
          entry.isDirectory() &&
          !SKIPPED_FOLDERS.has(entry.name) &&
          !/\.(xcodeproj|xcworkspace)$/.test(entry.name)
        ) {
          next.push(join(directory, entry.name));
        }
      }
    }
    next.sort();
    found.push(...next);
    level = next;
  }
  return found;
}

async function pinsIn(
  directory: string,
  userId: number | undefined,
): Promise<Pin[]> {
  const pins: Pin[] = [];
  for (const file of await resolvedFiles(directory, userId)) {
    const state = stateIn(await readFile(file, "utf8"));
    if (state) {
      pins.push({ ...state, file });
    }
  }
  return pins;
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
 * `object`). Anything that is not the expected shape, including a
 * supabase-swift pin without a revision, counts as no pin.
 */
function stateIn(contents: string): Omit<Pin, "file"> | undefined {
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
      const revision = text(state?.revision);
      return revision === undefined
        ? undefined
        : {
            revision,
            version: text(state?.version),
            branch: text(state?.branch),
          };
    }
  }
  return undefined;
}
