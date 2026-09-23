/**
 * How this package reaches Deno. `deno doc --json` does the heavy lifting of
 * resolving a function's module graph and describing its exported types, so
 * the extractor only needs something that can run the `deno` binary. The
 * Supabase CLI runs it inside the pinned edge-runtime container, the tests and
 * a plain checkout run the binary on the host; both implement
 * {@link DenoRunner}.
 */
import { execFile } from "node:child_process";
import { join } from "node:path";

export interface DenoRunRequest {
  /** Arguments after `deno`, with every path relative to `cwd`. */
  readonly args: readonly string[];
  /** Working directory for the command, relative to `projectRoot`. */
  readonly cwd: string;
  /** Absolute path of the project root on the machine calling the runner. */
  readonly projectRoot: string;
}

export interface DenoRunResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface DenoRunner {
  run(request: DenoRunRequest): Promise<DenoRunResult>;
}

export interface LocalDenoRunnerOptions {
  /** The `deno` executable to run; defaults to whatever `PATH` resolves. */
  readonly binary?: string;
  /** Upper bound on `deno doc` output in bytes. */
  readonly maxOutputBytes?: number;
}

/**
 * Run the `deno` binary installed on this machine. Paths in the request are
 * resolved against `projectRoot` as is, since the runner shares the caller's
 * filesystem.
 */
export function createLocalDenoRunner(
  options: LocalDenoRunnerOptions = {},
): DenoRunner {
  const binary = options.binary ?? "deno";
  const maxBuffer = options.maxOutputBytes ?? 256 * 1024 * 1024;
  return {
    run(request) {
      return new Promise((resolve) => {
        execFile(
          binary,
          [...request.args],
          {
            cwd: join(request.projectRoot, request.cwd),
            maxBuffer,
            env: { ...process.env, NO_COLOR: "1" },
          },
          (error, stdout, stderr) => {
            const exitCode =
              error === null
                ? 0
                : typeof error.code === "number"
                  ? error.code
                  : 1;
            resolve({
              exitCode,
              stdout,
              stderr: stripAnsi(
                error !== null && typeof error.code !== "number"
                  ? `${error.message}\n${stderr}`
                  : stderr,
              ),
            });
          },
        );
      });
    },
  };
}

/** Deno colours its warnings even when `NO_COLOR` is set; diagnostics carry plain text. */
function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE, "");
}

const ANSI_ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
