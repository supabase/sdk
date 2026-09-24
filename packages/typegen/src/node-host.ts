import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { win32 as windowsPath } from "node:path";
import type { Host, SpawnRequest, SpawnResult } from "./contract.ts";

export interface NodeHostOptions {
  readonly cwd: string;
  /** Defaults to `process.env`. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly signal?: AbortSignal;
  readonly format?: Host["format"];
}

type Env = Readonly<Record<string, string | undefined>>;

/** What `planSpawn` decided to hand to `child_process.spawn`. */
export interface SpawnPlan {
  readonly command: string;
  readonly args: readonly string[];
  readonly windowsVerbatimArguments?: boolean;
}

const WINDOWS_SCRIPT_EXTENSIONS = new Set([".bat", ".cmd"]);
const DEFAULT_PATHEXT = ".COM;.EXE;.BAT;.CMD";

/** Environment lookup that ignores key case, as Windows does. */
const envValue = (env: Env, name: string): string | undefined => {
  const wanted = name.toLowerCase();
  const key = Object.keys(env).find(
    (candidate) => candidate.toLowerCase() === wanted,
  );
  return key === undefined ? undefined : env[key];
};

const hasDirectory = (command: string): boolean =>
  windowsPath.isAbsolute(command) ||
  command.includes("\\") ||
  command.includes("/");

const isWindowsScript = (file: string): boolean =>
  WINDOWS_SCRIPT_EXTENSIONS.has(windowsPath.extname(file).toLowerCase());

/**
 * Finds `command` the way cmd.exe would, through `PATH` and `PATHEXT`.
 * Node's `spawn` does neither without a shell, and it refuses to start `.bat`
 * and `.cmd` files, which is how Flutter ships `dart` on Windows.
 */
export function resolveWindowsCommand(
  command: string,
  env: Env,
  exists: (path: string) => boolean = existsSync,
): string | undefined {
  const directories = hasDirectory(command)
    ? [""]
    : (envValue(env, "PATH") ?? "").split(";").filter(Boolean);
  const names = windowsPath.extname(command)
    ? [command]
    : (envValue(env, "PATHEXT") ?? DEFAULT_PATHEXT)
        .split(";")
        .filter(Boolean)
        .map((extension) => command + extension);
  for (const directory of directories) {
    for (const name of names) {
      const candidate = directory ? windowsPath.join(directory, name) : name;
      if (exists(candidate)) {
        return candidate;
      }
    }
  }
  return undefined;
}

const quoteForCmd = (argument: string): string =>
  /\s/.test(argument) ? `"${argument}"` : argument;

/**
 * Decides how to start `command`. Everywhere but Windows that is the command
 * as given, so a missing executable surfaces as Node's own `ENOENT`. On
 * Windows the command is resolved through `PATH` and `PATHEXT` first, and a
 * `.bat` or `.cmd` script is run through the command interpreter, since
 * `spawn` cannot start those directly. Returns `undefined` when the Windows
 * lookup finds nothing.
 */
export function planSpawn(
  command: string,
  args: readonly string[],
  env: Env,
  platform: NodeJS.Platform = process.platform,
  exists: (path: string) => boolean = existsSync,
): SpawnPlan | undefined {
  if (platform !== "win32") {
    return { command, args };
  }
  const resolved = resolveWindowsCommand(command, env, exists);
  if (resolved === undefined) {
    return undefined;
  }
  if (!isWindowsScript(resolved)) {
    return { command: resolved, args };
  }
  const commandLine = [resolved, ...args].map(quoteForCmd).join(" ");
  return {
    command: envValue(env, "ComSpec") ?? "cmd.exe",
    args: ["/d", "/s", "/c", `"${commandLine}"`],
    windowsVerbatimArguments: true,
  };
}

const commandNotFound = (command: string): Error =>
  Object.assign(new Error(`spawn ${command} ENOENT`), {
    code: "ENOENT",
    syscall: `spawn ${command}`,
    path: command,
  });

function spawnWithNode(request: SpawnRequest): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const plan = planSpawn(request.command, request.args, request.env);
    if (plan === undefined) {
      reject(commandNotFound(request.command));
      return;
    }
    const child = spawn(plan.command, [...plan.args], {
      cwd: request.cwd,
      env: { ...request.env } as NodeJS.ProcessEnv,
      stdio: ["pipe", "pipe", "pipe"],
      signal: request.signal,
      windowsVerbatimArguments: plan.windowsVerbatimArguments,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({
        exitCode,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
    // A tool that exits before reading its input closes the pipe early; the
    // exit code and stderr already explain that, so the write error is noise.
    child.stdin.on("error", () => {});
    child.stdin.end(request.stdin);
  });
}

/**
 * A `Host` backed by `node:child_process`, for consumers without their own
 * process runner and for exercising out-of-process entries against a real
 * tool in tests.
 */
export function createNodeHost(options: NodeHostOptions): Host {
  const host: Host = {
    cwd: options.cwd,
    env: options.env ?? process.env,
    signal: options.signal,
    spawn: spawnWithNode,
  };
  if (options.format) {
    return { ...host, format: options.format };
  }
  return host;
}
