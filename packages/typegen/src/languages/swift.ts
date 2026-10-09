import { existsSync } from "node:fs";
import {
  chmod,
  mkdir,
  readdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { gunzipSync } from "node:zlib";
import type { ChoiceOptionSpec, Host, TypegenLanguage } from "../contract.ts";
import { ToolNotInstalledError, TypegenError } from "../errors.ts";
import { resolveOptions } from "../options.ts";
import { externalLanguage } from "./external.ts";

const SWIFT_ACCESS_CONTROL = "swift-access-control";
const BINARY = "supabase-typegen";
const RELEASES = "https://github.com/supabase/supabase-swift/releases";
const REPOSITORY = /github\.com[/:]supabase\/supabase-swift(\.git)?\/?$/i;

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

const installHint = `Set SUPABASE_TYPEGEN to a \`${BINARY}\` binary, or put one on PATH. Download it from the supabase-swift release your project depends on (${RELEASES}).`;

/** Release asset names, keyed by `process.platform` and `process.arch`. */
const assets: Readonly<Record<string, string>> = {
  "darwin-arm64": "supabase-typegen-macos-universal.tar.gz",
  "darwin-x64": "supabase-typegen-macos-universal.tar.gz",
  "linux-x64": "supabase-typegen-linux-x86_64.tar.gz",
};

export interface SwiftDependencies {
  readonly platform: string;
  readonly arch: string;
  readonly fetch: (url: string, init?: RequestInit) => Promise<Response>;
}

/**
 * Swift runs `supabase-typegen` from supabase-swift, which reads the document
 * on stdin and writes one file of `@Table` structs to stdout.
 *
 * The generated code targets the `@Table` macro of one supabase-swift
 * version, so the binary must come from the same release as the project's
 * dependency. The entry reads that version from the nearest
 * `Package.resolved` (SwiftPM, or Xcode's copy inside the `.xcodeproj` or
 * `.xcworkspace`), downloads the release's binary once into the user's cache
 * and runs it. Without a version pin, or on a platform with no release asset,
 * it runs `supabase-typegen` from PATH. `SUPABASE_TYPEGEN` overrides both.
 *
 * It is a binary, not a package dependency, because its swift-format
 * dependency would pin every app's swift-syntax, and because an Xcode project
 * without a `Package.swift` has nothing to `swift run` from. No `--schema` is
 * passed: the document already holds exactly the schemas the consumer
 * introspected, and the tool generates all of them.
 */
export function createSwift(
  dependencies: SwiftDependencies = {
    platform: process.platform,
    arch: process.arch,
    fetch: (url, init) => fetch(url, init),
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
  { platform, arch, fetch }: SwiftDependencies,
): Promise<string> {
  const override = host.env.SUPABASE_TYPEGEN;
  if (override) {
    return override;
  }
  const asset = assets[`${platform}-${arch}`];
  const version = asset ? await pinnedVersion(host.cwd) : undefined;
  if (!asset || !version) {
    return BINARY;
  }
  const path = join(cacheDirectory(host.env, platform), version, BINARY);
  if (existsSync(path)) {
    return path;
  }
  const url = `${RELEASES}/download/v${version}/${asset}`;
  const response = await fetch(url, host.signal ? { signal: host.signal } : {});
  if (response.status === 404) {
    throw new ToolNotInstalledError({
      language: "swift",
      tool: BINARY,
      installHint,
      message: `supabase-swift ${version}, which ${host.cwd} depends on, has no \`${BINARY}\` release asset (${url}). Update supabase-swift to a release that ships it, or: ${installHint}`,
    });
  }
  if (!response.ok) {
    throw new TypegenError({
      language: "swift",
      message: `Downloading ${url} failed with HTTP ${response.status}. ${installHint}`,
    });
  }
  const binary = extract(
    gunzipSync(new Uint8Array(await response.arrayBuffer())),
    BINARY,
  );
  if (!binary) {
    throw new TypegenError({
      language: "swift",
      message: `${url} does not contain \`${BINARY}\`. ${installHint}`,
    });
  }
  // Written beside the target and renamed, so a concurrent run never sees a partial file.
  await mkdir(dirname(path), { recursive: true });
  const partial = `${path}.${process.pid}.partial`;
  await writeFile(partial, binary);
  await chmod(partial, 0o755);
  await rename(partial, path);
  return path;
}

function cacheDirectory(
  env: Readonly<Record<string, string | undefined>>,
  platform: string,
): string {
  const base =
    env.XDG_CACHE_HOME ??
    join(env.HOME ?? "", platform === "darwin" ? "Library/Caches" : ".cache");
  return join(base, "supabase", "typegen");
}

/**
 * The supabase-swift version pinned by the nearest `Package.resolved`, looking
 * in `cwd` and then each parent. Returns `undefined` when nothing pins it to a
 * version, for example a branch or revision pin.
 */
async function pinnedVersion(cwd: string): Promise<string | undefined> {
  for (let directory = cwd; ; directory = dirname(directory)) {
    for (const file of await resolvedFiles(directory)) {
      const version = versionIn(await readFile(file, "utf8"));
      if (version) {
        return version;
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
  readonly state?: { readonly version?: string };
}

/** Reads every `Package.resolved` format: version 1 nests the pins under `object`. */
function versionIn(contents: string): string | undefined {
  let parsed: { pins?: Pin[]; object?: { pins?: Pin[] } };
  try {
    parsed = JSON.parse(contents);
  } catch {
    return undefined;
  }
  const pins = parsed.pins ?? parsed.object?.pins ?? [];
  return pins.find((pin) =>
    REPOSITORY.test(pin.location ?? pin.repositoryURL ?? ""),
  )?.state?.version;
}

/**
 * The regular file called `name` in an uncompressed tar archive. Enough of the
 * format for the release assets: 512-byte headers, the name at offset 0, the
 * size in octal at 124, the type at 156, data padded to 512 bytes.
 */
function extract(archive: Uint8Array, name: string): Uint8Array | undefined {
  const text = new TextDecoder();
  for (let offset = 0; offset + 512 <= archive.length;) {
    const header = archive.subarray(offset, offset + 512);
    const entry = text.decode(header.subarray(0, 100)).replace(/\0.*$/s, "");
    if (entry === "") {
      return undefined;
    }
    const size = Number.parseInt(
      text.decode(header.subarray(124, 136)).replace(/\0.*$/s, "").trim() ||
        "0",
      8,
    );
    const type = header[156];
    const start = offset + 512;
    // Type "0" or NUL is a regular file; pax ("x", "g") and others are skipped.
    if ((type === 0x30 || type === 0) && entry.replace(/^\.\//, "") === name) {
      return archive.slice(start, start + size);
    }
    offset = start + Math.ceil(size / 512) * 512;
  }
  return undefined;
}
