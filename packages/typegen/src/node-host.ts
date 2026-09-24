import { spawn } from "node:child_process";
import type { Host, SpawnRequest, SpawnResult } from "./contract.ts";

export interface NodeHostOptions {
  readonly cwd: string;
  /** Defaults to `process.env`. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly signal?: AbortSignal;
  readonly format?: Host["format"];
}

function spawnWithNode(request: SpawnRequest): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(request.command, [...request.args], {
      cwd: request.cwd,
      env: { ...request.env } as NodeJS.ProcessEnv,
      stdio: ["pipe", "pipe", "pipe"],
      signal: request.signal,
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
