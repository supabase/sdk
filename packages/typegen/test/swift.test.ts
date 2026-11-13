import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  serializeGeneratorMetadata,
  sortGeneratorMetadata,
} from "@supabase/postgrest-typegen";
import {
  createNodeHost,
  InvalidOptionError,
  MetadataRejectedError,
  swift,
  ToolFailedError,
  ToolNotInstalledError,
  TypegenError,
} from "../src/index.ts";
import {
  compareVersions,
  createSwift,
  latestRelease,
  parseRefs,
  parseTypegenSource,
} from "../src/languages/swift.ts";
import { commandNotFound, createFakeHost, rejection } from "./helpers.ts";
import { unsortedMetadata } from "./fixtures.ts";

const success = (stdout: string) => ({ exitCode: 0, stdout, stderr: "" });
const LIST_TAGS =
  "git ls-remote --tags https://github.com/supabase/supabase-swift";

const REVISION = "0123456789abcdef0123456789abcdef01234567";
const OTHER = "fedcba9876543210fedcba9876543210fedcba98";

describe("swift", () => {
  let cache: string;

  beforeEach(() => {
    cache = realpathSync(mkdtempSync(join(tmpdir(), "typegen-swift-cache-")));
    mkdirSync(dirname(binary()), { recursive: true });
    writeFileSync(binary(), "");
  });

  afterEach(() => {
    rmSync(cache, { recursive: true, force: true });
  });

  /** The binary a commit-SHA source finds already built, so nothing else is spawned. */
  const binary = () =>
    join(cache, "supabase/typegen", REVISION, "supabase-typegen");

  const generate = (
    respond: Parameters<typeof createFakeHost>[0],
    values: Record<string, string> = {},
  ) => {
    const host = createFakeHost(respond, {
      env: { PATH: "/usr/bin", HOME: "/home/dev", XDG_CACHE_HOME: cache },
    });
    const output = createSwift({
      platform: "darwin",
      temporaryDirectory: () => cache,
      log: () => {},
      userId: () => undefined,
    }).generate(
      unsortedMetadata,
      { "swift-typegen-source": REVISION, ...values },
      host,
    );
    return { host, output };
  };

  test("runs supabase-typegen in the project with the sorted document on stdin", async () => {
    const { host, output } = generate(() => success("struct Tickets {}\n"));

    expect(await output).toBe("struct Tickets {}\n");
    expect(host.requests).toHaveLength(1);
    const request = host.requests[0]!;
    expect(request.command).toBe(binary());
    expect(request.args).toEqual(["--access-control", "internal"]);
    expect(request.cwd).toBe(host.cwd);
    expect(request.stdin).toBe(
      serializeGeneratorMetadata(sortGeneratorMetadata(unsortedMetadata)),
    );
  });

  test("maps swift-access-control to --access-control", async () => {
    const { host, output } = generate(() => success(""), {
      "swift-access-control": "public",
    });
    await output;
    expect(host.requests[0]!.args).toEqual(["--access-control", "public"]);
  });

  test("rejects the levels the generator does not accept before spawning", async () => {
    for (const level of ["private", "package"]) {
      const host = createFakeHost();
      expect(
        await rejection(
          swift.generate(
            unsortedMetadata,
            { "swift-access-control": level },
            host,
          ),
        ),
      ).toBeInstanceOf(InvalidOptionError);
      expect(host.requests).toHaveLength(0);
    }
  });

  test("reports a missing supabase-typegen with a hint that names swift-typegen-source", async () => {
    const { output } = generate(() => {
      throw commandNotFound(binary());
    });
    const error = await rejection(output);
    expect(error).toBeInstanceOf(ToolNotInstalledError);
    const notInstalled = error as ToolNotInstalledError;
    expect(notInstalled.tool).toBe(binary());
    expect(notInstalled.installHint).toContain("--swift-typegen-source");
    expect(notInstalled.installHint).not.toContain("SUPABASE_TYPEGEN");
    expect(notInstalled.installHint).not.toContain("PATH");
  });

  test("reports exit 65 as a rejected document", async () => {
    const { output } = generate(() => ({
      exitCode: 65,
      stdout: "",
      stderr: "error: unsupported GeneratorMetadata version '7'.\n",
    }));
    const error = await rejection(output);
    expect(error).toBeInstanceOf(MetadataRejectedError);
    expect((error as MetadataRejectedError).stderr).toBe(
      "error: unsupported GeneratorMetadata version '7'.",
    );
  });

  test("reports any other failure with the exit code and stderr", async () => {
    const { output } = generate(() => ({
      exitCode: 1,
      stdout: "",
      stderr: "error: the primary key column 'todos.id' is nullable.\n",
    }));
    const error = await rejection(output);
    expect(error).toBeInstanceOf(ToolFailedError);
    expect(error).not.toBeInstanceOf(MetadataRejectedError);
    expect((error as ToolFailedError).message).toBe(
      `\`${binary()} --access-control internal\` exited with code 1.\nerror: the primary key column 'todos.id' is nullable.`,
    );
  });

  test("refuses Windows, where the source build is not supported", async () => {
    const host = createFakeHost(() => success(""));
    const error = await rejection(
      createSwift({
        platform: "win32",
        temporaryDirectory: () => cache,
        log: () => {},
        userId: () => undefined,
      }).generate(unsortedMetadata, {}, host),
    );
    expect(error).toBeInstanceOf(TypegenError);
    expect((error as TypegenError).message).toContain("Windows");
    expect(host.requests).toEqual([]);
  });
});

/**
 * Stand-ins for `git` and `swift`, put alone on PATH. Each appends its command
 * line to `$FAKE_LOG`. `git ls-remote` lists `$FAKE_HEADS` for a branch and
 * `$FAKE_TAGS` otherwise (`\c` lists nothing), `git` fakes a fetch of the
 * revision it is given, and checking it out creates `tools/supabase-typegen`
 * unless `FAKE_NO_TYPEGEN` is set. `swift build` writes a `supabase-typegen`
 * into its `--package-path` that prints `$FAKE_TYPEGEN_VERSION` for
 * `--version` and otherwise the package's `marker` file, or `generated`
 * without one. The `FAKE_*_FAIL` variables make a step fail the way the real
 * tool does. Both fail if a git repository variable reaches them. They call
 * coreutils by absolute path because PATH holds only the fakes.
 */
const FAKE_GIT = `#!/bin/sh
echo "git $*" >> "$FAKE_LOG"
if [ -n "$GIT_DIR$GIT_WORK_TREE$GIT_INDEX_FILE$GIT_OBJECT_DIRECTORY" ]; then
  echo "a repository variable leaked in" >&2
  exit 3
fi
case "$1" in
  --version) echo "git version 2.50.0" ;;
  ls-remote)
    case "$*" in
      *refs/heads/*)
        if [ -n "$FAKE_HEADS" ]; then printf '%b' "$FAKE_HEADS"
        else printf '%s\\trefs/heads/main\\n' ${REVISION}; fi ;;
      *)
        if [ -n "$FAKE_TAGS" ]; then printf '%b' "$FAKE_TAGS"
        else printf '%s\\trefs/tags/v3.0.0-alpha.1\\n' ${REVISION}; fi ;;
    esac ;;
  clone)
    for argument; do directory=$argument; done
    /bin/mkdir "$directory" ;;
  merge-base) if [ -n "$FAKE_NOT_ON_BRANCH" ]; then exit 1; fi ;;
  init) /bin/mkdir .git ;;
  fetch)
    if [ -n "$FAKE_FETCH_FAIL" ]; then
      echo "fatal: remote error: upload-pack: not our ref $5" >&2
      exit 128
    fi
    for argument; do revision=$argument; done
    echo "$revision" > .git/FAKE_FETCH_HEAD ;;
  checkout)
    /bin/cp .git/FAKE_FETCH_HEAD .git/FAKE_HEAD
    if [ -z "$FAKE_NO_TYPEGEN" ]; then
      /bin/mkdir -p tools/supabase-typegen
      echo "// swift-tools-version:6.2" > tools/supabase-typegen/Package.swift
    fi ;;
  rev-parse) if [ -n "$FAKE_HEAD" ]; then echo "$FAKE_HEAD"; else /bin/cat .git/FAKE_HEAD; fi ;;
  *) echo "unexpected git $*" >&2; exit 2 ;;
esac
`;

const FAKE_SWIFT = `#!/bin/sh
echo "swift $*" >> "$FAKE_LOG"
if [ -n "$GIT_DIR$GIT_WORK_TREE$GIT_INDEX_FILE$GIT_OBJECT_DIRECTORY" ]; then
  echo "a repository variable leaked in" >&2
  exit 3
fi
case "$1" in
  --version) echo "Swift version 6.2" ;;
  build)
    if [ -n "$FAKE_BUILD_FAIL" ]; then
      echo "Sources/SupabaseTypegen/Typegen.swift:1:1: error: cannot find 'x' in scope"
      echo "error: fatalError" >&2
      exit 1
    fi
    package=tools/supabase-typegen
    previous=
    for argument; do
      if [ "$previous" = --package-path ]; then package=$argument; fi
      previous=$argument
    done
    output=generated
    if [ -f "$package/marker" ]; then output=$(/bin/cat "$package/marker"); fi
    /bin/mkdir -p "$package/.build/release"
    binary="$package/.build/release/supabase-typegen"
    printf '#!/bin/sh\\necho "typegen $*" >> "$FAKE_LOG"\\nif [ "$1" = --version ]; then echo %s; exit 0; fi\\n/bin/cat > /dev/null\\necho %s\\n' "\${FAKE_TYPEGEN_VERSION:-3.0.0-alpha.1}" "$output" > "$binary"
    /bin/chmod 755 "$binary" ;;
  *) echo "unexpected swift $*" >&2; exit 2 ;;
esac
`;

describe("swift source build", () => {
  let root: string;
  let bin: string;
  let scratch: string;
  let logFile: string;
  let messages: string[];

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), "typegen-swift-")));
    bin = join(root, "bin");
    scratch = join(root, "tmp");
    logFile = join(root, "commands.log");
    messages = [];
    mkdirSync(bin);
    mkdirSync(scratch);
    writeFileSync(logFile, "");
    writeFileSync(join(bin, "git"), FAKE_GIT, { mode: 0o755 });
    writeFileSync(join(bin, "swift"), FAKE_SWIFT, { mode: 0o755 });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const pin = (state: Record<string, string>) =>
    JSON.stringify({
      pins: [
        {
          identity: "swift-crypto",
          location: "https://github.com/apple/swift-crypto.git",
          state: { version: "3.0.0", revision: "f".repeat(40) },
        },
        {
          identity: "supabase-swift",
          location: "https://github.com/supabase/supabase-swift.git",
          state,
        },
      ],
      version: 2,
    });

  const versionPin = (version = "3.0.0-alpha.1") =>
    pin({ version, revision: REVISION });

  const project = (files: Record<string, string>) => {
    const cwd = join(root, "app");
    mkdirSync(cwd, { recursive: true });
    for (const [path, contents] of Object.entries(files)) {
      mkdirSync(dirname(join(cwd, path)), { recursive: true });
      writeFileSync(join(cwd, path), contents);
    }
    return cwd;
  };

  const make = (platform = "darwin", userId = process.getuid?.()) =>
    createSwift({
      platform,
      temporaryDirectory: () => scratch,
      log: (message) => messages.push(message),
      userId: () => userId,
    });

  const run = (
    cwd: string,
    env: Record<string, string> = {},
    platform = "darwin",
    values: Record<string, string> = {},
  ) =>
    make(platform).generate(
      unsortedMetadata,
      values,
      createNodeHost({
        cwd,
        env: {
          PATH: bin,
          HOME: join(root, "home"),
          FAKE_LOG: logFile,
          ...env,
        },
      }),
    );

  const ran = (prefix: string) =>
    commands().some((line) => line.startsWith(prefix));
  const commands = () => readFileSync(logFile, "utf8").split("\n").slice(0, -1);
  /** Runs with `swift-typegen-source` set to `source`. */
  const runFrom = (
    cwd: string,
    source: string,
    env: Record<string, string> = {},
  ) => run(cwd, env, "darwin", { "swift-typegen-source": source });
  const cached = (cache = "home/Library/Caches", revision = REVISION) =>
    join(root, cache, "supabase/typegen", revision, "supabase-typegen");
  const leftovers = () => [
    ...readdirSync(scratch),
    ...(existsSync(dirname(cached())) ? readdirSync(dirname(cached())) : []),
  ];

  test("builds the pinned commit from source, caches the binary and runs it", async () => {
    const cwd = project({ "Package.resolved": versionPin() });

    expect(await run(cwd)).toBe("generated\n");

    expect(commands()).toEqual([
      "git --version",
      "swift --version",
      "git ls-remote https://github.com/supabase/supabase-swift refs/tags/3.0.0-alpha.1 refs/tags/3.0.0-alpha.1^{} refs/tags/v3.0.0-alpha.1 refs/tags/v3.0.0-alpha.1^{}",
      "git init",
      `git fetch --depth 1 https://github.com/supabase/supabase-swift ${REVISION}`,
      "git checkout --detach FETCH_HEAD",
      "git rev-parse HEAD",
      "swift build -c release --package-path tools/supabase-typegen --disable-automatic-resolution",
      "typegen --version",
      "typegen --access-control internal",
    ]);
    expect(statSync(cached()).mode & 0o777).toBe(0o755);
    expect(readdirSync(dirname(cached()))).toEqual(["supabase-typegen"]);
    expect(readdirSync(scratch)).toEqual([]);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toBe(
      "Using version `3.0.0-alpha.1` at `0123456…`, pinned in Package.resolved.",
    );
    expect(messages[1]).toContain(
      "Building supabase-typegen 3.0.0-alpha.1 from source",
    );
    expect(messages[1]).toContain("a few minutes");
  });

  test("runs the cached binary without git or swift", async () => {
    const cwd = project({ "Package.resolved": versionPin() });
    await run(cwd);
    writeFileSync(logFile, "");
    messages = [];

    expect(await run(cwd)).toBe("generated\n");

    expect(commands()).toEqual(["typegen --access-control internal"]);
    expect(messages).toEqual([
      "Using version `3.0.0-alpha.1` at `0123456…`, pinned in Package.resolved.",
    ]);
  });

  test("builds a branch pin once its revision is on that upstream branch", async () => {
    const cwd = project({
      "Package.resolved": pin({ branch: "release/v3", revision: REVISION }),
    });

    expect(await run(cwd)).toBe("generated\n");

    expect(commands().slice(2, 5)).toEqual([
      "git clone --bare --filter=tree:0 --no-tags --single-branch --branch release/v3 https://github.com/supabase/supabase-swift history.git",
      `git merge-base --is-ancestor ${REVISION} HEAD`,
      "git init",
    ]);
    expect(ran("git ls-remote")).toBe(false);
    expect(commands()).not.toContain("typegen --version");
    expect(existsSync(cached())).toBe(true);
  });

  test("checks a bare revision pin against the default branch", async () => {
    const cwd = project({ "Package.resolved": pin({ revision: REVISION }) });
    await run(cwd);
    expect(commands()).toContain(
      "git clone --bare --filter=tree:0 --no-tags --single-branch https://github.com/supabase/supabase-swift history.git",
    );
  });

  test("refuses a revision that is not on its upstream branch, such as a fork's commit", async () => {
    const cwd = project({
      "Package.resolved": pin({ branch: "main", revision: REVISION }),
    });
    const error = await rejection(run(cwd, { FAKE_NOT_ON_BRANCH: "1" }));
    expect(error).toBeInstanceOf(TypegenError);
    expect((error as TypegenError).message).toContain(
      `${REVISION} is not on supabase-swift's main branch`,
    );
    expect(ran("git fetch")).toBe(false);
    expect(leftovers()).toEqual([]);
  });

  test("accepts an annotated tag through its peeled commit", async () => {
    const cwd = project({ "Package.resolved": versionPin() });
    const tag = "f".repeat(40);
    expect(
      await run(cwd, {
        FAKE_TAGS: `${tag}\\trefs/tags/3.0.0-alpha.1\\n${REVISION}\\trefs/tags/3.0.0-alpha.1^{}\\n`,
      }),
    ).toBe("generated\n");
  });

  test("refuses a version pin whose tag points at another commit", async () => {
    const cwd = project({ "Package.resolved": versionPin() });
    for (const tags of [
      `${"e".repeat(40)}\\trefs/tags/v3.0.0-alpha.1\\n`,
      "",
    ]) {
      writeFileSync(logFile, "");
      const error = await rejection(run(cwd, { FAKE_TAGS: tags || "\\c" }));
      expect(error).toBeInstanceOf(TypegenError);
      expect((error as TypegenError).message).toContain(
        `supabase-swift's 3.0.0-alpha.1 tag does not point at ${REVISION}`,
      );
      expect(ran("git fetch")).toBe(false);
      expect(leftovers()).toEqual([]);
    }
  });

  test("refuses a malformed version or branch before running git", async () => {
    const states: Record<string, string>[] = [
      { version: "3.0.0\u001b]0;x\u0007", revision: REVISION },
      { version: "--upload-pack=x", revision: REVISION },
      { branch: "--upload-pack=x", revision: REVISION },
      { branch: "main:refs/heads/x", revision: REVISION },
    ];
    for (const state of states) {
      const cwd = project({ "Package.resolved": pin(state) });
      const error = await rejection(run(cwd));
      expect(error).toBeInstanceOf(TypegenError);
      expect((error as TypegenError).message).not.toContain("\u001b");
      expect(commands()).toEqual([]);
    }
  });

  test("skips a Package.resolved owned by another user", async () => {
    const cwd = project({ "Package.resolved": versionPin() });
    expect(
      await make("darwin", (process.getuid?.() ?? 0) + 1).generate(
        unsortedMetadata,
        {},
        createNodeHost({
          cwd,
          env: { PATH: bin, HOME: join(root, "home"), FAKE_LOG: logFile },
        }),
      ),
    ).toBe("generated\n");
    expect(commands()[0]).toBe(LIST_TAGS);
    expect(messages[0]).toStartWith("No supabase-swift pin found");
  });

  test("skips malformed and non-regular Package.resolved files", async () => {
    const malformed = [
      "null",
      '{"pins":{}}',
      '{"pins":[null]}',
      "[1]",
      pin({ version: "3.0.0-alpha.1" }),
    ];
    for (const contents of malformed) {
      writeFileSync(logFile, "");
      const cwd = project({ "Package.resolved": contents });
      expect(await run(cwd)).toBe("generated\n");
      expect(commands()[0]).toBe(LIST_TAGS);
    }
    writeFileSync(logFile, "");
    const cwd = project({});
    rmSync(join(cwd, "Package.resolved"), { force: true });
    execFileSync("/usr/bin/mkfifo", [join(cwd, "Package.resolved")]);
    expect(await run(cwd)).toBe("generated\n");
    expect(commands()[0]).toBe(LIST_TAGS);
  });

  test("reads an Xcode project's Package.resolved in the version 1 format", async () => {
    const cwd = project({
      "App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved":
        JSON.stringify({
          object: {
            pins: [
              {
                package: "Supabase",
                repositoryURL: "https://github.com/supabase/supabase-swift",
                state: { version: "3.0.0-alpha.1", revision: REVISION },
              },
            ],
          },
          version: 1,
        }),
    });
    await run(cwd);
    expect(existsSync(cached())).toBe(true);
  });

  test("finds Package.resolved in a parent directory", async () => {
    const cwd = project({ "Package.resolved": versionPin() });
    mkdirSync(join(cwd, "Sources/App"), { recursive: true });
    await run(join(cwd, "Sources/App"));
    expect(existsSync(cached())).toBe(true);
  });

  test("links the Swift runtime statically on Linux", async () => {
    const cwd = project({ "Package.resolved": versionPin() });
    await run(cwd, {}, "linux");
    expect(commands()).toContain(
      "swift build -c release --package-path tools/supabase-typegen --disable-automatic-resolution --static-swift-stdlib",
    );
  });

  test("uses XDG_CACHE_HOME and ~/.cache outside macOS", async () => {
    const cwd = project({ "Package.resolved": versionPin() });
    await run(cwd, {}, "linux");
    expect(existsSync(cached("home/.cache"))).toBe(true);
    await run(cwd, { XDG_CACHE_HOME: join(root, "xdg") }, "linux");
    expect(existsSync(cached("xdg"))).toBe(true);
  });

  test("ignores an empty or relative XDG_CACHE_HOME", async () => {
    const cwd = project({ "Package.resolved": versionPin() });
    for (const XDG_CACHE_HOME of ["", "relative/cache"]) {
      await run(cwd, { XDG_CACHE_HOME }, "linux");
      expect(existsSync(cached("home/.cache"))).toBe(true);
    }
  });

  test("keeps the user's git repository variables away from the build", async () => {
    // Git exports these to hooks, for example when gen types runs in pre-commit.
    const cwd = project({ "Package.resolved": versionPin() });
    const repository = join(root, "user-repo/.git");
    expect(
      await run(cwd, {
        GIT_DIR: repository,
        GIT_WORK_TREE: dirname(repository),
        GIT_INDEX_FILE: join(repository, "index"),
        GIT_OBJECT_DIRECTORY: join(repository, "objects"),
      }),
    ).toBe("generated\n");
  });

  test("two concurrent first runs both succeed", async () => {
    const cwd = project({ "Package.resolved": versionPin() });
    expect(await Promise.all([run(cwd), run(cwd)])).toEqual([
      "generated\n",
      "generated\n",
    ]);
    expect(readdirSync(dirname(cached()))).toEqual(["supabase-typegen"]);
    expect(readdirSync(scratch)).toEqual([]);
  });

  test("reads neither SUPABASE_TYPEGEN nor a supabase-typegen on PATH", async () => {
    const cwd = project({});
    const stray = join(bin, "supabase-typegen");
    writeFileSync(
      stray,
      '#!/bin/sh\necho "stray $*" >> "$FAKE_LOG"\necho stray\n',
      {
        mode: 0o755,
      },
    );
    expect(await run(cwd, { SUPABASE_TYPEGEN: stray })).toBe("generated\n");
    expect(ran("stray")).toBe(false);
    expect(existsSync(cached())).toBe(true);
  });

  test("refuses a revision that is not a full commit SHA without running git", async () => {
    for (const revision of ["abc", "--upload-pack=touch", "A".repeat(40)]) {
      const cwd = project({
        "Package.resolved": pin({ version: "3.0.0-alpha.1", revision }),
      });
      const error = await rejection(run(cwd));
      expect(error).toBeInstanceOf(TypegenError);
      expect((error as TypegenError).message).toContain("40-character");
      expect(commands()).toEqual([]);
    }
  });

  for (const tool of ["git", "swift"]) {
    test(`names a missing ${tool} and the minimum toolchain before fetching`, async () => {
      rmSync(join(bin, tool));
      const cwd = project({ "Package.resolved": versionPin() });
      const error = await rejection(run(cwd));
      expect(error).toBeInstanceOf(ToolNotInstalledError);
      expect((error as ToolNotInstalledError).tool).toBe(tool);
      expect((error as ToolNotInstalledError).message).toContain(
        "Swift 6.2 / Xcode 26",
      );
      expect(ran("git fetch")).toBe(false);
      expect(leftovers()).toEqual([]);
    });
  }

  test("reports a supabase-swift without supabase-typegen as not installed", async () => {
    const cwd = project({ "Package.resolved": versionPin("2.56.0") });
    const error = await rejection(
      run(cwd, {
        FAKE_NO_TYPEGEN: "1",
        FAKE_TAGS: `${REVISION}\\trefs/tags/2.56.0\\n`,
      }),
    );
    expect(error).toBeInstanceOf(ToolNotInstalledError);
    expect((error as ToolNotInstalledError).message).toContain(
      "supabase-swift 2.56.0 has no supabase-typegen; update to 3.0.0-alpha.1 or newer",
    );
    expect(ran("swift build")).toBe(false);
    expect(leftovers()).toEqual([]);
  });

  test("reports a failed fetch with git's error", async () => {
    const cwd = project({ "Package.resolved": versionPin() });
    const error = await rejection(run(cwd, { FAKE_FETCH_FAIL: "1" }));
    expect(error).toBeInstanceOf(TypegenError);
    expect((error as TypegenError).message).toContain(
      "upload-pack: not our ref",
    );
    expect(leftovers()).toEqual([]);
  });

  test("refuses a checkout whose HEAD is not the pinned revision", async () => {
    const cwd = project({ "Package.resolved": versionPin() });
    const error = await rejection(run(cwd, { FAKE_HEAD: "e".repeat(40) }));
    expect(error).toBeInstanceOf(TypegenError);
    expect((error as TypegenError).message).toContain(REVISION);
    expect(ran("swift build")).toBe(false);
    expect(leftovers()).toEqual([]);
  });

  test("forwards the swift build errors", async () => {
    const cwd = project({ "Package.resolved": versionPin() });
    const error = await rejection(run(cwd, { FAKE_BUILD_FAIL: "1" }));
    expect(error).toBeInstanceOf(ToolFailedError);
    const { message, exitCode, stderr } = error as ToolFailedError;
    expect(exitCode).toBe(1);
    expect(stderr).toBe("error: fatalError");
    expect(message).toContain("swift build");
    expect(message).toContain("error: cannot find 'x' in scope");
    expect(message).toContain("error: fatalError");
    expect(leftovers()).toEqual([]);
  });

  test("refuses a binary whose --version differs from the pin, and does not cache it", async () => {
    const cwd = project({ "Package.resolved": versionPin() });
    const error = await rejection(
      run(cwd, { FAKE_TYPEGEN_VERSION: "3.0.0-alpha.2" }),
    );
    expect(error).toBeInstanceOf(TypegenError);
    expect((error as TypegenError).message).toContain("3.0.0-alpha.2");
    expect(commands()).not.toContain("typegen --access-control internal");
    expect(leftovers()).toEqual([]);
  });

  test("validates options before building", async () => {
    const cwd = project({ "Package.resolved": versionPin() });
    const error = await rejection(
      make().generate(
        unsortedMetadata,
        { "swift-access-control": "open" },
        createNodeHost({ cwd, env: { PATH: bin, FAKE_LOG: logFile } }),
      ),
    );
    expect(error).toBeInstanceOf(InvalidOptionError);
    expect(commands()).toEqual([]);
  });

  describe("swift-typegen-source", () => {
    const tagLookup = (tag: string) =>
      `git ls-remote https://github.com/supabase/supabase-swift refs/tags/v${tag} refs/tags/v${tag}^{} refs/tags/${tag} refs/tags/${tag}^{}`;
    const checkoutAndBuild = [
      "git init",
      `git fetch --depth 1 https://github.com/supabase/supabase-swift ${REVISION}`,
      "git checkout --detach FETCH_HEAD",
      "git rev-parse HEAD",
      "swift build -c release --package-path tools/supabase-typegen --disable-automatic-resolution",
    ];

    for (const value of ["3.0.0-alpha.1", "v3.0.0-alpha.1"]) {
      test(`builds the tagged commit of version ${value} over the lockfile pin`, async () => {
        const cwd = project({
          "Package.resolved": pin({
            version: "3.0.0-alpha.2",
            revision: OTHER,
          }),
        });

        expect(await runFrom(cwd, value)).toBe("generated\n");

        expect(commands()).toEqual([
          tagLookup("3.0.0-alpha.1"),
          "git --version",
          "swift --version",
          ...checkoutAndBuild,
          "typegen --version",
          "typegen --access-control internal",
        ]);
        expect(messages[0]).toBe(
          "Using version `3.0.0-alpha.1` at `0123456…`.",
        );
        expect(existsSync(cached())).toBe(true);
        expect(existsSync(cached(undefined, OTHER))).toBe(false);
      });
    }

    test("builds the commit an annotated version tag points at", async () => {
      const cwd = project({});
      expect(
        await runFrom(cwd, "3.0.0-alpha.1", {
          FAKE_TAGS: `${"a".repeat(40)}\\trefs/tags/v3.0.0-alpha.1\\n${REVISION}\\trefs/tags/v3.0.0-alpha.1^{}\\n`,
        }),
      ).toBe("generated\n");
      expect(existsSync(cached())).toBe(true);
    });

    test("resolves a branch on every run and reuses the cache while it stays put", async () => {
      const cwd = project({});

      expect(await runFrom(cwd, "main")).toBe("generated\n");
      expect(commands()).toEqual([
        "git ls-remote https://github.com/supabase/supabase-swift refs/heads/main",
        "git --version",
        "swift --version",
        ...checkoutAndBuild,
        "typegen --access-control internal",
      ]);
      expect(messages[0]).toBe("Using branch `main` at `0123456…`.");

      writeFileSync(logFile, "");
      expect(await runFrom(cwd, "main")).toBe("generated\n");
      expect(commands()).toEqual([
        "git ls-remote https://github.com/supabase/supabase-swift refs/heads/main",
        "typegen --access-control internal",
      ]);

      writeFileSync(logFile, "");
      messages = [];
      expect(
        await runFrom(cwd, "main", {
          FAKE_HEADS: `${OTHER}\\trefs/heads/main\\n`,
        }),
      ).toBe("generated\n");
      expect(ran("swift build")).toBe(true);
      expect(messages[0]).toBe("Using branch `main` at `fedcba9…`.");
      expect(existsSync(cached(undefined, OTHER))).toBe(true);
    });

    test("matches the branch exactly in the ls-remote listing", async () => {
      const cwd = project({});
      const error = await rejection(
        runFrom(cwd, "main", {
          FAKE_HEADS: `${REVISION}\\trefs/heads/feature/main\\n`,
        }),
      );
      expect(error).toBeInstanceOf(TypegenError);
      expect((error as TypegenError).message).toBe(
        "No branch named `main` in supabase/supabase-swift.",
      );
    });

    test("builds a full commit SHA once it is on the default branch", async () => {
      const cwd = project({});

      expect(await runFrom(cwd, REVISION.toUpperCase())).toBe("generated\n");

      expect(commands()).toEqual([
        "git --version",
        "swift --version",
        "git clone --bare --filter=tree:0 --no-tags --single-branch https://github.com/supabase/supabase-swift history.git",
        `git merge-base --is-ancestor ${REVISION} HEAD`,
        ...checkoutAndBuild,
        "typegen --access-control internal",
      ]);
      expect(messages[0]).toBe("Using commit `0123456…`.");
      expect(existsSync(cached())).toBe(true);
    });

    test("refuses a full commit SHA that is not upstream's", async () => {
      const cwd = project({});
      const error = await rejection(
        runFrom(cwd, REVISION, { FAKE_NOT_ON_BRANCH: "1" }),
      );
      expect(error).toBeInstanceOf(TypegenError);
      expect((error as TypegenError).message).toContain(
        `${REVISION} is not on supabase-swift's default branch`,
      );
      expect((error as TypegenError).message).toContain(
        "--swift-typegen-source",
      );
      expect(ran("git fetch")).toBe(false);
      expect(leftovers()).toEqual([]);
    });

    test("builds a local checkout in place, with its uncommitted changes, and never caches it", async () => {
      const cwd = project({ "Package.resolved": versionPin() });
      const checkout = join(root, "supabase-swift");
      const packagePath = join(checkout, "tools/supabase-typegen");
      mkdirSync(packagePath, { recursive: true });
      writeFileSync(join(packagePath, "Package.swift"), "");
      writeFileSync(join(packagePath, "marker"), "first");

      expect(await runFrom(cwd, "../supabase-swift")).toBe("first\n");
      expect(commands()).toEqual([
        `swift build -c release --package-path ${packagePath}`,
        "typegen --access-control internal",
      ]);
      expect(messages[0]).toContain(`Using the local checkout ${checkout}`);
      expect(
        existsSync(join(packagePath, ".build/release/supabase-typegen")),
      ).toBe(true);

      writeFileSync(join(packagePath, "marker"), "second");
      writeFileSync(logFile, "");
      expect(await runFrom(cwd, "../supabase-swift")).toBe("second\n");
      expect(ran("swift build")).toBe(true);
      expect(existsSync(join(root, "home/Library/Caches"))).toBe(false);
      expect(readdirSync(scratch)).toEqual([]);
    });

    test("expands ~ in a local checkout path", async () => {
      const cwd = project({});
      const packagePath = join(
        root,
        "home/src/supabase-swift/tools/supabase-typegen",
      );
      mkdirSync(packagePath, { recursive: true });
      writeFileSync(join(packagePath, "Package.swift"), "");
      expect(await runFrom(cwd, "~/src/supabase-swift")).toBe("generated\n");
      expect(commands()[0]).toBe(
        `swift build -c release --package-path ${packagePath}`,
      );
    });

    test("refuses a local path without tools/supabase-typegen", async () => {
      const cwd = project({});
      mkdirSync(join(cwd, "old-checkout"));
      for (const value of ["./old-checkout", "./missing"]) {
        const error = await rejection(runFrom(cwd, value));
        expect(error).toBeInstanceOf(InvalidOptionError);
        expect((error as InvalidOptionError).message).toContain(
          "has no tools/supabase-typegen",
        );
      }
      expect(commands()).toEqual([]);
    });

    test("refuses an abbreviated commit SHA without running git", async () => {
      const cwd = project({});
      const error = await rejection(runFrom(cwd, REVISION.slice(0, 7)));
      expect(error).toBeInstanceOf(InvalidOptionError);
      expect((error as InvalidOptionError).option).toBe("swift-typegen-source");
      expect((error as InvalidOptionError).message).toContain(
        "full 40-character SHA",
      );
      expect(commands()).toEqual([]);
    });

    test("points a relative path without ./ at the ./ form", async () => {
      const cwd = project({});
      mkdirSync(join(cwd, "supabase-swift"));
      const error = await rejection(
        runFrom(cwd, "supabase-swift", { FAKE_HEADS: "\\c" }),
      );
      expect(error).toBeInstanceOf(TypegenError);
      expect((error as TypegenError).message).toBe(
        `No branch named \`supabase-swift\` in supabase/supabase-swift. To build the local checkout at ${join(cwd, "supabase-swift")}, pass ./supabase-swift.`,
      );
      expect(ran("git fetch")).toBe(false);
    });

    test("names the tag or branch a failed lookup tried", async () => {
      const cwd = project({});
      const tag = await rejection(
        runFrom(cwd, "v3.0.0-alpa.1", { FAKE_TAGS: "\\c" }),
      );
      expect(tag).toBeInstanceOf(TypegenError);
      expect((tag as TypegenError).message).toStartWith(
        "No tag named `v3.0.0-alpa.1` in supabase/supabase-swift",
      );
      const branch = await rejection(
        runFrom(cwd, "release/v9", { FAKE_HEADS: "\\c" }),
      );
      expect((branch as TypegenError).message).toBe(
        "No branch named `release/v9` in supabase/supabase-swift.",
      );
      expect(ran("git fetch")).toBe(false);
      expect(leftovers()).toEqual([]);
    });

    test("refuses a 2.x version without running git", async () => {
      const cwd = project({});
      const error = await rejection(runFrom(cwd, "2.56.0"));
      expect(error).toBeInstanceOf(InvalidOptionError);
      expect((error as InvalidOptionError).message).toContain(
        "supabase-swift 2.56.0 has no supabase-typegen; pass 3.0.0-alpha.1 or newer",
      );
      expect(commands()).toEqual([]);
    });

    test("refuses a branch name git could read as an option or a refspec", async () => {
      const cwd = project({});
      for (const value of [
        "--upload-pack=touch",
        "-b",
        "has space",
        "a..b",
        "main:refs/heads/x",
        "main\u001b]0;x\u0007",
        "",
      ]) {
        const error = await rejection(runFrom(cwd, value));
        expect(error).toBeInstanceOf(InvalidOptionError);
        expect((error as InvalidOptionError).message).not.toContain("\u001b");
      }
      expect(commands()).toEqual([]);
    });
  });

  describe("lockfile walk", () => {
    test("skips a Package.resolved without a supabase-swift pin", async () => {
      const app = project({
        "Package.resolved": versionPin(),
        "ios/Package.resolved": JSON.stringify({
          pins: [
            {
              identity: "swift-crypto",
              location: "https://github.com/apple/swift-crypto.git",
              state: { version: "3.0.0", revision: OTHER },
            },
          ],
          version: 2,
        }),
      });
      expect(await run(join(app, "ios"))).toBe("generated\n");
      expect(messages[0]).toBe(
        "Using version `3.0.0-alpha.1` at `0123456…`, pinned in ../Package.resolved.",
      );
    });

    test("reads an Xcode workspace's Package.resolved", async () => {
      const cwd = project({
        "App.xcworkspace/xcshareddata/swiftpm/Package.resolved": versionPin(),
      });
      await run(cwd);
      expect(existsSync(cached())).toBe(true);
    });

    test("searches two levels down when no parent has a pin, skipping dependency folders", async () => {
      const cwd = project({
        "apps/ios/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved":
          versionPin(),
        "apps/macos/Package.resolved": versionPin(),
        "apps/ios/deeper/Package.resolved": pin({ revision: OTHER }),
        "node_modules/Package.resolved": pin({ revision: OTHER }),
        ".build/checkouts/Package.resolved": pin({ revision: OTHER }),
        "Pods/Package.resolved": pin({ revision: OTHER }),
        "DerivedData/Package.resolved": pin({ revision: OTHER }),
        ".git/Package.resolved": pin({ revision: OTHER }),
      });
      expect(await run(cwd)).toBe("generated\n");
      expect(messages[0]).toBe(
        "Using version `3.0.0-alpha.1` at `0123456…`, pinned in apps/ios/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved.",
      );
      expect(existsSync(cached(undefined, OTHER))).toBe(false);
    });

    test("asks for swift-typegen-source when the lockfiles below disagree", async () => {
      const cwd = project({
        "ios/Package.resolved": versionPin(),
        "server/Package.resolved": pin({ branch: "main", revision: OTHER }),
      });
      const error = await rejection(run(cwd));
      expect(error).toBeInstanceOf(TypegenError);
      const { message } = error as TypegenError;
      expect(message).toContain("pin different supabase-swift revisions");
      expect(message).toContain(`ios/Package.resolved: "${REVISION}"`);
      expect(message).toContain(`server/Package.resolved: "${OTHER}"`);
      expect(message).toContain("--swift-typegen-source");
      expect(commands()).toEqual([]);
    });

    test("prefers a parent's pin over the lockfiles below", async () => {
      const cwd = project({
        "Package.resolved": versionPin(),
        "web/ios/Package.resolved": pin({ revision: OTHER }),
        "web/server/Package.resolved": pin({ revision: "e".repeat(40) }),
      });
      expect(await run(cwd)).toBe("generated\n");
      expect(existsSync(cached())).toBe(true);
    });
  });

  describe("latest release", () => {
    test("builds the highest 3.x prerelease and says why", async () => {
      const cwd = project({});
      const annotated = "a".repeat(40);
      const tags = [
        `${"1".repeat(40)}\trefs/tags/v2.40.0`,
        `${"2".repeat(40)}\trefs/tags/v3.0.0-alpha.9`,
        `${annotated}\trefs/tags/v3.0.0-alpha.10`,
        `${OTHER}\trefs/tags/v3.0.0-alpha.10^{}`,
        `${"4".repeat(40)}\trefs/tags/v4.0.0-alpha.1`,
      ];

      expect(
        await run(cwd, {
          FAKE_TAGS: tags.join("\\n").replaceAll("\t", "\\t"),
          FAKE_TYPEGEN_VERSION: "3.0.0-alpha.10",
        }),
      ).toBe("generated\n");

      expect(commands()[0]).toBe(LIST_TAGS);
      expect(commands()).toContain(
        `git fetch --depth 1 https://github.com/supabase/supabase-swift ${OTHER}`,
      );
      expect(commands()).toContain("typegen --version");
      expect(ran("git clone")).toBe(false);
      expect(messages[0]).toBe(
        `No supabase-swift pin found from \`${cwd}\`. Using 3.0.0-alpha.10 (latest) at \`fedcba9…\`. Run from your app directory, or pass --swift-typegen-source, to match your pinned version.`,
      );
      expect(existsSync(cached(undefined, OTHER))).toBe(true);
    });

    test("fails when supabase-swift has no 3.x release", async () => {
      const cwd = project({});
      const error = await rejection(
        run(cwd, { FAKE_TAGS: `${OTHER}\\trefs/tags/v2.40.0\\n` }),
      );
      expect(error).toBeInstanceOf(TypegenError);
      expect((error as TypegenError).message).toContain("no 3.x release");
      expect(commands()).toEqual([LIST_TAGS]);
    });
  });
});

describe("parseTypegenSource", () => {
  const base = { cwd: "/work/app", home: "/home/dev" };
  const parse = (value: string) => parseTypegenSource(value, base);
  const reason = (value: string) => {
    try {
      parse(value);
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidOptionError);
      return (error as InvalidOptionError).message;
    }
    throw new Error(`${value} was accepted`);
  };

  test("reads ./, ../, / and ~/ as local paths", () => {
    expect(parse("./supabase-swift")).toEqual({
      kind: "path",
      path: "/work/app/supabase-swift",
    });
    expect(parse("../supabase-swift")).toEqual({
      kind: "path",
      path: "/work/supabase-swift",
    });
    expect(parse(".")).toEqual({ kind: "path", path: "/work/app" });
    expect(parse("/src/supabase-swift/")).toEqual({
      kind: "path",
      path: "/src/supabase-swift",
    });
    expect(parse("~/src/supabase-swift")).toEqual({
      kind: "path",
      path: "/home/dev/src/supabase-swift",
    });
    expect(parse("~")).toEqual({ kind: "path", path: "/home/dev" });
    expect(parse("./3.0.0")).toEqual({ kind: "path", path: "/work/app/3.0.0" });
  });

  test("refuses other forms that start like a path", () => {
    for (const value of [".hidden", "...", "~other/supabase-swift"]) {
      expect(reason(value)).toContain("Start a relative path with ./");
    }
  });

  test("reads 40 hex characters as a commit, in lowercase", () => {
    expect(parse(REVISION.toUpperCase())).toEqual({
      kind: "commit",
      revision: REVISION,
    });
  });

  test("refuses an abbreviated commit SHA", () => {
    for (const value of [REVISION.slice(0, 7), REVISION.slice(0, 39)]) {
      expect(reason(value)).toContain("full 40-character SHA");
    }
  });

  test("reads a semantic version with or without v", () => {
    for (const value of [
      "3.0.0",
      "v3.0.0",
      "3.0.0-alpha.1",
      "v3.1.2+build.5",
    ]) {
      expect(parse(value)).toEqual({
        kind: "version",
        version: value.replace(/^v/, ""),
      });
    }
  });

  test("reads anything else that is a plain branch name as a branch", () => {
    for (const value of ["main", "release/v3", "feat/typegen-1.2", "v3"]) {
      expect(parse(value)).toEqual({ kind: "branch", branch: value });
    }
  });

  test("refuses a branch name git could read as an option or a refspec", () => {
    for (const value of [
      "-b",
      "--upload-pack=touch",
      "a b",
      "a\tb",
      "a..b",
      "main:x",
      "main^{}",
      "x\u0000y",
      "x\u009by",
      "",
    ]) {
      const message = reason(value);
      expect(message).toContain("not a version");
      const control = Array.from({ length: message.length }, (_unused, index) =>
        message.charCodeAt(index),
      ).filter((code) => code < 0x20 || (code >= 0x7f && code <= 0x9f));
      expect(control).toEqual([]);
    }
  });
});

describe("compareVersions", () => {
  test("orders by semantic version precedence", () => {
    const ordered = [
      "2.99.99",
      "3.0.0-alpha",
      "3.0.0-alpha.1",
      "3.0.0-alpha.2",
      "3.0.0-alpha.9",
      "3.0.0-alpha.10",
      "3.0.0-alpha.beta",
      "3.0.0-beta",
      "3.0.0-beta.2",
      "3.0.0-beta.11",
      "3.0.0-rc.1",
      "3.0.0",
      "3.0.1",
      "3.1.0",
      "3.10.0",
    ];
    const shuffled = [...ordered].reverse();
    expect(shuffled.sort(compareVersions)).toEqual(ordered);
    expect(compareVersions("3.0.0+build.1", "3.0.0")).toBe(0);
  });
});

describe("latestRelease", () => {
  test("takes the highest prerelease while there is no stable release", () => {
    expect(
      latestRelease(
        ["v3.0.0-alpha.9", "v3.0.0-alpha.10", "v3.0.0-alpha.2", "v2.40.0"],
        3,
      ),
    ).toEqual({ tag: "v3.0.0-alpha.10", version: "3.0.0-alpha.10" });
  });

  test("prefers the highest stable release once one exists", () => {
    expect(
      latestRelease(["v3.0.0", "v3.2.0-beta.1", "v3.1.4", "v3.1.10"], 3),
    ).toEqual({ tag: "v3.1.10", version: "3.1.10" });
  });

  test("never crosses the major version", () => {
    expect(
      latestRelease(["v2.40.0", "v4.0.0", "v4.0.0-alpha.1"], 3),
    ).toBeUndefined();
    expect(latestRelease(["v3.0.0-alpha.1", "v4.0.0"], 3)).toEqual({
      tag: "v3.0.0-alpha.1",
      version: "3.0.0-alpha.1",
    });
  });

  test("reads tags without v and skips what is not a version", () => {
    expect(
      latestRelease(["3.0.0", "latest", "v3", "release-3.5.0"], 3),
    ).toEqual({ tag: "3.0.0", version: "3.0.0" });
  });
});

describe("parseRefs", () => {
  test("maps refs to commits, preferring an annotated tag's commit", () => {
    const listing = [
      `${"a".repeat(40)}\trefs/tags/v3.0.0`,
      `${REVISION}\trefs/tags/v3.0.0^{}`,
      `${OTHER}\trefs/heads/main`,
      "not-a-sha\trefs/heads/broken",
      "",
    ].join("\n");
    expect([...parseRefs(listing)]).toEqual([
      ["refs/tags/v3.0.0", REVISION],
      ["refs/heads/main", OTHER],
    ]);
  });
});
