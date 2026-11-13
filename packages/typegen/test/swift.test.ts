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
import { createSwift } from "../src/languages/swift.ts";
import { commandNotFound, createFakeHost, rejection } from "./helpers.ts";
import { unsortedMetadata } from "./fixtures.ts";

const success = (stdout: string) => ({ exitCode: 0, stdout, stderr: "" });

describe("swift", () => {
  test("runs supabase-typegen in the project with the sorted document on stdin", async () => {
    const host = createFakeHost(() => success("struct Tickets {}\n"));
    const output = await swift.generate(unsortedMetadata, {}, host);

    expect(output).toBe("struct Tickets {}\n");
    const request = host.requests[0]!;
    expect(request.command).toBe("supabase-typegen");
    expect(request.args).toEqual(["--access-control", "internal"]);
    expect(request.cwd).toBe(host.cwd);
    expect(request.stdin).toBe(
      serializeGeneratorMetadata(sortGeneratorMetadata(unsortedMetadata)),
    );
  });

  test("maps swift-access-control to --access-control", async () => {
    const host = createFakeHost(() => success(""));
    await swift.generate(
      unsortedMetadata,
      { "swift-access-control": "public" },
      host,
    );
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

  test("reports a missing supabase-typegen with an install hint", async () => {
    const host = createFakeHost(() => {
      throw commandNotFound("supabase-typegen");
    });
    const error = await rejection(swift.generate(unsortedMetadata, {}, host));
    expect(error).toBeInstanceOf(ToolNotInstalledError);
    const notInstalled = error as ToolNotInstalledError;
    expect(notInstalled.tool).toBe("supabase-typegen");
    expect(notInstalled.installHint).toContain("SUPABASE_TYPEGEN");
  });

  test("reports exit 65 as a rejected document", async () => {
    const host = createFakeHost(() => ({
      exitCode: 65,
      stdout: "",
      stderr: "error: unsupported GeneratorMetadata version '7'.\n",
    }));
    const error = await rejection(swift.generate(unsortedMetadata, {}, host));
    expect(error).toBeInstanceOf(MetadataRejectedError);
    expect((error as MetadataRejectedError).stderr).toBe(
      "error: unsupported GeneratorMetadata version '7'.",
    );
  });

  test("reports any other failure with the exit code and stderr", async () => {
    const host = createFakeHost(() => ({
      exitCode: 1,
      stdout: "",
      stderr: "error: the primary key column 'todos.id' is nullable.\n",
    }));
    const error = await rejection(swift.generate(unsortedMetadata, {}, host));
    expect(error).toBeInstanceOf(ToolFailedError);
    expect(error).not.toBeInstanceOf(MetadataRejectedError);
    expect((error as ToolFailedError).message).toBe(
      "`supabase-typegen --access-control internal` exited with code 1.\nerror: the primary key column 'todos.id' is nullable.",
    );
  });
});

const REVISION = "0123456789abcdef0123456789abcdef01234567";

/**
 * Stand-ins for `git` and `swift`, put alone on PATH. Each appends its command
 * line to `$FAKE_LOG`. `git` fakes a fetch of the revision it is given, and
 * checking it out creates `tools/supabase-typegen` unless `FAKE_NO_TYPEGEN` is
 * set. `swift build` writes a `supabase-typegen` that prints
 * `$FAKE_TYPEGEN_VERSION` for `--version` and `generated` otherwise. The
 * `FAKE_*_FAIL` variables make a step fail the way the real tool does. Both
 * fail if a git repository variable reaches them. They
 * call coreutils by absolute path because PATH holds only the fakes.
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
    if [ -n "$FAKE_TAGS" ]; then printf '%b' "$FAKE_TAGS"
    else printf '%s\\trefs/tags/v3.0.0-alpha.1\\n' ${REVISION}; fi ;;
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
    /bin/mkdir -p tools/supabase-typegen/.build/release
    binary=tools/supabase-typegen/.build/release/supabase-typegen
    printf '#!/bin/sh\\necho "typegen $*" >> "$FAKE_LOG"\\nif [ "$1" = --version ]; then echo %s; exit 0; fi\\n/bin/cat > /dev/null\\necho generated\\n' "\${FAKE_TYPEGEN_VERSION:-3.0.0-alpha.1}" > "$binary"
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
  ) =>
    make(platform).generate(
      unsortedMetadata,
      {},
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
  const cached = (cache = "home/Library/Caches") =>
    join(root, cache, "supabase/typegen", REVISION, "supabase-typegen");
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
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain(
      "Building supabase-typegen 3.0.0-alpha.1 from source",
    );
    expect(messages[0]).toContain("a few minutes");
  });

  test("runs the cached binary without git or swift", async () => {
    const cwd = project({ "Package.resolved": versionPin() });
    await run(cwd);
    writeFileSync(logFile, "");
    messages = [];

    expect(await run(cwd)).toBe("generated\n");

    expect(commands()).toEqual(["typegen --access-control internal"]);
    expect(messages).toEqual([]);
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
    const error = await rejection(
      make("darwin", (process.getuid?.() ?? 0) + 1).generate(
        unsortedMetadata,
        {},
        createNodeHost({ cwd, env: { PATH: bin, FAKE_LOG: logFile } }),
      ),
    );
    expect(error).toBeInstanceOf(ToolNotInstalledError);
    expect((error as ToolNotInstalledError).tool).toBe("supabase-typegen");
    expect(ran("git")).toBe(false);
  });

  test("skips malformed and non-regular Package.resolved files", async () => {
    for (const contents of ["null", '{"pins":{}}', '{"pins":[null]}', "[1]"]) {
      const cwd = project({ "Package.resolved": contents });
      const error = await rejection(run(cwd));
      expect(error).toBeInstanceOf(ToolNotInstalledError);
    }
    const cwd = project({});
    rmSync(join(cwd, "Package.resolved"), { force: true });
    execFileSync("/usr/bin/mkfifo", [join(cwd, "Package.resolved")]);
    expect(await rejection(run(cwd))).toBeInstanceOf(ToolNotInstalledError);
    expect(commands()).toEqual([]);
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

  test("falls back to PATH without a supabase-swift pin", async () => {
    const cwd = project({});
    writeFileSync(
      join(bin, "supabase-typegen"),
      '#!/bin/sh\necho "typegen $*" >> "$FAKE_LOG"\necho from-path\n',
      { mode: 0o755 },
    );
    expect(await run(cwd)).toBe("from-path\n");
    expect(commands()).toEqual(["typegen --access-control internal"]);
  });

  test("falls back to PATH on Windows", async () => {
    const cwd = project({ "Package.resolved": versionPin() });
    const language = make("win32");
    const host = createFakeHost(() => success(""), { cwd });
    await language.generate(unsortedMetadata, {}, host);
    expect(host.requests.map((request) => request.command)).toEqual([
      "supabase-typegen",
    ]);
  });

  test("SUPABASE_TYPEGEN overrides the source build", async () => {
    const cwd = project({ "Package.resolved": versionPin() });
    const host = createFakeHost(() => success(""), {
      cwd,
      env: { SUPABASE_TYPEGEN: "/opt/dev/supabase-typegen" },
    });
    await make().generate(unsortedMetadata, {}, host);
    expect(host.requests.map((request) => request.command)).toEqual([
      "/opt/dev/supabase-typegen",
    ]);
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
});
