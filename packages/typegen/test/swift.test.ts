import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
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
    expect(notInstalled.installHint).toContain(
      "https://github.com/supabase/supabase-swift/releases",
    );
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

describe("swift binary resolution", () => {
  const binary = "#!/bin/sh\necho generated\n";
  let tarball: Uint8Array;
  let root: string;

  beforeAll(() => {
    const source = mkdtempSync(join(tmpdir(), "typegen-asset-"));
    writeFileSync(join(source, "supabase-typegen"), binary, { mode: 0o755 });
    // The system tar, as the supabase-swift release job uses: bsdtar on macOS adds pax headers.
    execFileSync(
      "tar",
      ["-czf", "asset.tar.gz", "-C", source, "supabase-typegen"],
      {
        cwd: source,
      },
    );
    tarball = new Uint8Array(readFileSync(join(source, "asset.tar.gz")));
  });

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "typegen-swift-"));
  });

  const resolvedV2 = (version: string) =>
    JSON.stringify({
      pins: [
        {
          identity: "swift-crypto",
          location: "https://github.com/apple/swift-crypto.git",
          state: { version: "3.0.0" },
        },
        {
          identity: "supabase-swift",
          location: "https://github.com/supabase/supabase-swift.git",
          state: { version, revision: "abc" },
        },
      ],
      version: 2,
    });

  const project = (files: Record<string, string>) => {
    const cwd = join(root, "app");
    for (const [path, contents] of Object.entries(files)) {
      mkdirSync(dirname(join(cwd, path)), { recursive: true });
      writeFileSync(join(cwd, path), contents);
    }
    mkdirSync(cwd, { recursive: true });
    return cwd;
  };

  const setup = (
    cwd: string,
    respond: (url: string) => Response = () =>
      new Response(tarball, { status: 200 }),
    env: Record<string, string> = {},
  ) => {
    const urls: string[] = [];
    const language = createSwift({
      platform: "darwin",
      arch: "arm64",
      fetch: async (url) => {
        urls.push(String(url));
        return respond(String(url));
      },
    });
    const host = createFakeHost(() => success("code\n"), {
      cwd,
      env: { HOME: join(root, "home"), ...env },
    });
    return { language, host, urls };
  };

  test("downloads the release the project's Package.resolved pins and runs it", async () => {
    const cwd = project({ "Package.resolved": resolvedV2("2.56.0") });
    const { language, host, urls } = setup(cwd);

    expect(await language.generate(unsortedMetadata, {}, host)).toBe("code\n");

    expect(urls).toEqual([
      "https://github.com/supabase/supabase-swift/releases/download/v2.56.0/supabase-typegen-macos-universal.tar.gz",
    ]);
    const command = host.requests[0]!.command;
    expect(command).toBe(
      join(
        root,
        "home/Library/Caches/supabase/typegen/2.56.0/supabase-typegen",
      ),
    );
    expect(readFileSync(command, "utf8")).toBe(binary);
    expect(statSync(command).mode & 0o777).toBe(0o755);
  });

  test("reuses the cached binary", async () => {
    const cwd = project({ "Package.resolved": resolvedV2("2.56.0") });
    const { language, host, urls } = setup(cwd);
    await language.generate(unsortedMetadata, {}, host);
    await language.generate(unsortedMetadata, {}, host);
    expect(urls).toHaveLength(1);
    expect(host.requests).toHaveLength(2);
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
                state: { version: "2.40.0" },
              },
            ],
          },
          version: 1,
        }),
    });
    const { language, host, urls } = setup(cwd);
    await language.generate(unsortedMetadata, {}, host);
    expect(urls[0]).toContain("/download/v2.40.0/");
  });

  test("finds Package.resolved in a parent directory", async () => {
    const cwd = project({ "Package.resolved": resolvedV2("2.56.0") });
    mkdirSync(join(cwd, "Sources/App"), { recursive: true });
    const { language, host, urls } = setup(join(cwd, "Sources/App"));
    await language.generate(unsortedMetadata, {}, host);
    expect(urls[0]).toContain("/download/v2.56.0/");
  });

  test("picks the Linux asset on Linux x86_64", async () => {
    const cwd = project({ "Package.resolved": resolvedV2("2.56.0") });
    const urls: string[] = [];
    const language = createSwift({
      platform: "linux",
      arch: "x64",
      fetch: async (url) => {
        urls.push(String(url));
        return new Response(tarball);
      },
    });
    const host = createFakeHost(() => success(""), {
      cwd,
      env: { HOME: join(root, "home"), XDG_CACHE_HOME: join(root, "xdg") },
    });
    await language.generate(unsortedMetadata, {}, host);
    expect(urls[0]).toEndWith("/supabase-typegen-linux-x86_64.tar.gz");
    expect(host.requests[0]!.command).toBe(
      join(root, "xdg/supabase/typegen/2.56.0/supabase-typegen"),
    );
  });

  test("falls back to PATH without a version pin", async () => {
    const branchPin = JSON.stringify({
      pins: [
        {
          identity: "supabase-swift",
          location: "https://github.com/supabase/supabase-swift",
          state: { branch: "main", revision: "abc" },
        },
      ],
      version: 3,
    });
    for (const cwd of [
      project({}),
      project({ "Package.resolved": branchPin }),
    ]) {
      const { language, host, urls } = setup(cwd);
      await language.generate(unsortedMetadata, {}, host);
      expect(urls).toEqual([]);
      expect(host.requests.at(-1)!.command).toBe("supabase-typegen");
    }
  });

  test("falls back to PATH on a platform without a release asset", async () => {
    const cwd = project({ "Package.resolved": resolvedV2("2.56.0") });
    const language = createSwift({
      platform: "win32",
      arch: "x64",
      fetch: async () => fail("must not download"),
    });
    const host = createFakeHost(() => success(""), { cwd });
    await language.generate(unsortedMetadata, {}, host);
    expect(host.requests[0]!.command).toBe("supabase-typegen");
  });

  test("SUPABASE_TYPEGEN overrides the download", async () => {
    const cwd = project({ "Package.resolved": resolvedV2("2.56.0") });
    const { language, host, urls } = setup(cwd, undefined, {
      SUPABASE_TYPEGEN: "/opt/dev/supabase-typegen",
    });
    await language.generate(unsortedMetadata, {}, host);
    expect(urls).toEqual([]);
    expect(host.requests[0]!.command).toBe("/opt/dev/supabase-typegen");
  });

  test("reports a release without the binary as not installed", async () => {
    const cwd = project({ "Package.resolved": resolvedV2("2.10.0") });
    const { language, host } = setup(
      cwd,
      () => new Response("Not Found", { status: 404 }),
    );
    const error = await rejection(
      language.generate(unsortedMetadata, {}, host),
    );
    expect(error).toBeInstanceOf(ToolNotInstalledError);
    expect((error as ToolNotInstalledError).message).toContain("2.10.0");
    expect(host.requests).toHaveLength(0);
  });

  test("reports any other download failure", async () => {
    const cwd = project({ "Package.resolved": resolvedV2("2.56.0") });
    const { language, host } = setup(
      cwd,
      () => new Response("", { status: 503 }),
    );
    const error = await rejection(
      language.generate(unsortedMetadata, {}, host),
    );
    expect(error).toBeInstanceOf(TypegenError);
    expect((error as TypegenError).message).toContain("503");
  });

  test("validates options before downloading", async () => {
    const cwd = project({ "Package.resolved": resolvedV2("2.56.0") });
    const { language, host, urls } = setup(cwd);
    expect(
      await rejection(
        language.generate(
          unsortedMetadata,
          { "swift-access-control": "open" },
          host,
        ),
      ),
    ).toBeInstanceOf(InvalidOptionError);
    expect(urls).toEqual([]);
  });
});

const fail = (message: string): never => {
  throw new Error(message);
};
