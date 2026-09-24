import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  serializeGeneratorMetadata,
  sortGeneratorMetadata,
} from "@supabase/postgrest-typegen";
import {
  createNodeHost,
  dart,
  planSpawn,
  resolveWindowsCommand,
  ToolFailedError,
  ToolNotInstalledError,
} from "../src/index.ts";
import { unsortedMetadata } from "./fixtures.ts";
import { rejection } from "./helpers.ts";

/**
 * A stand-in `dart` on PATH: echoes its arguments and stdin so the test can
 * check the handoff, or fails the way the real tool does when asked to.
 */
const FAKE_DART = `#!/bin/sh
if [ "$FAKE_DART_MODE" = "fail" ]; then
  echo "something went wrong" >&2
  exit 3
fi
printf 'args: %s\\n' "$*"
printf 'cwd: %s\\n' "$(pwd)"
cat
echo "summary" >&2
`;

describe("createNodeHost", () => {
  let dir: string;
  let bin: string;
  let path: string;

  beforeEach(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), "typegen-node-host-")));
    bin = join(dir, "bin");
    mkdirSync(bin);
    path = `${bin}:/usr/bin:/bin`;
    writeFileSync(join(bin, "dart"), FAKE_DART, { mode: 0o755, flag: "wx" });
    chmodSync(join(bin, "dart"), 0o755);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("runs the tool in cwd with the document on stdin and captures stdout", async () => {
    const host = createNodeHost({ cwd: dir, env: { PATH: path } });
    const output = await dart.generate(unsortedMetadata, {}, host);
    const document = serializeGeneratorMetadata(
      sortGeneratorMetadata(unsortedMetadata),
    );
    expect(output).toBe(
      `args: run supabase_typegen --output -\ncwd: ${dir}\n${document}`,
    );
  });

  test("turns a missing executable into ToolNotInstalledError", async () => {
    const host = createNodeHost({
      cwd: dir,
      env: { PATH: join(dir, "empty") },
    });
    expect(
      await rejection(dart.generate(unsortedMetadata, {}, host)),
    ).toBeInstanceOf(ToolNotInstalledError);
  });

  test("captures stderr and the exit code of a failing tool", async () => {
    const host = createNodeHost({
      cwd: dir,
      env: { PATH: path, FAKE_DART_MODE: "fail" },
    });
    const error = await rejection(dart.generate(unsortedMetadata, {}, host));
    expect(error).toBeInstanceOf(ToolFailedError);
    expect((error as ToolFailedError).exitCode).toBe(3);
    expect((error as ToolFailedError).stderr).toBe("something went wrong");
  });

  test("defaults env to process.env and forwards signal and format", () => {
    const controller = new AbortController();
    const format = async (code: string) => code;
    const host = createNodeHost({
      cwd: dir,
      signal: controller.signal,
      format,
    });
    expect(host.env).toBe(process.env);
    expect(host.signal).toBe(controller.signal);
    expect(host.format).toBe(format);
    expect(createNodeHost({ cwd: dir }).format).toBeUndefined();
  });
});

describe("planSpawn", () => {
  const args = ["run", "supabase_typegen", "--output", "-"];
  const env = { Path: "C:\\tools;C:\\flutter\\bin", HOME: "C:\\Users\\dev" };
  const files = new Set(["c:\\flutter\\bin\\dart.bat", "c:\\tools\\go.exe"]);
  // Windows file names are case-insensitive, and PATHEXT is upper case.
  const exists = (path: string) => files.has(path.toLowerCase());

  test("passes the command through unchanged off Windows", () => {
    expect(planSpawn("dart", args, env, "darwin", exists)).toEqual({
      command: "dart",
      args,
    });
    expect(planSpawn("dart", args, env, "linux", () => false)).toEqual({
      command: "dart",
      args,
    });
  });

  test("runs a .bat found through PATH and PATHEXT via cmd.exe", () => {
    expect(planSpawn("dart", args, env, "win32", exists)).toEqual({
      command: "cmd.exe",
      args: [
        "/d",
        "/s",
        "/c",
        '"C:\\flutter\\bin\\dart.BAT run supabase_typegen --output -"',
      ],
      windowsVerbatimArguments: true,
    });
  });

  test("honors ComSpec and quotes arguments with spaces", () => {
    const plan = planSpawn(
      "dart",
      ["--import", "my package"],
      { ...env, ComSpec: "C:\\Windows\\System32\\cmd.exe" },
      "win32",
      exists,
    );
    expect(plan?.command).toBe("C:\\Windows\\System32\\cmd.exe");
    expect(plan?.args[3]).toBe(
      '"C:\\flutter\\bin\\dart.BAT --import "my package""',
    );
  });

  test("starts an .exe directly", () => {
    expect(planSpawn("go", ["version"], env, "win32", exists)).toEqual({
      command: "C:\\tools\\go.EXE",
      args: ["version"],
    });
  });

  test("reports a command PATH does not hold as not found", () => {
    expect(planSpawn("swift", args, env, "win32", exists)).toBeUndefined();
  });

  test("resolves an explicit path and extension without searching PATH", () => {
    expect(
      resolveWindowsCommand("C:\\flutter\\bin\\dart.bat", {}, exists),
    ).toBe("C:\\flutter\\bin\\dart.bat");
    expect(resolveWindowsCommand("dart.bat", env, exists)).toBe(
      "C:\\flutter\\bin\\dart.bat",
    );
    expect(resolveWindowsCommand("dart.exe", env, exists)).toBeUndefined();
  });

  test("respects a custom PATHEXT", () => {
    expect(
      resolveWindowsCommand("dart", { ...env, PATHEXT: ".EXE" }, exists),
    ).toBeUndefined();
  });
});
