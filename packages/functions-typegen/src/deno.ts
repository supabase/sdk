/**
 * How this package reaches Deno. `deno doc --json` does the heavy lifting of
 * resolving a function's module graph and describing its exported types, so
 * the extractor only needs something that can run the `deno` binary from the
 * project root. Consumers that already own a process runner, such as the
 * `@supabase/typegen` registry with its `Host.spawn`, wrap it with
 * {@link createSpawnDenoRunner}; a plain checkout and the tests use
 * {@link createLocalDenoRunner}, the same runner over `node:child_process`.
 */
import { execFile } from "node:child_process";

export interface DenoRunRequest {
  /** Arguments after `deno`, with every path relative to `projectRoot`. */
  readonly args: readonly string[];
  /** Absolute path of the project root; the command runs there. */
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

/**
 * A request to run one command to completion. Structurally the same as the
 * `SpawnRequest` of `@supabase/typegen`, declared here so this package does
 * not depend on the registry that depends on it.
 */
export interface SpawnRequest {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Written to the child's stdin before it is closed; always empty here. */
  readonly stdin: string;
  readonly signal?: AbortSignal;
}

export interface SpawnResult {
  /** Exit code, or `null` when the process was ended by a signal. */
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Runs a command to completion. Rejects when the command cannot be started
 * at all (Node reports `ENOENT`); a non-zero exit resolves normally.
 */
export type SpawnFunction = (request: SpawnRequest) => Promise<SpawnResult>;

export interface SpawnDenoRunnerOptions {
  /** The Deno executable to run; defaults to `deno` on `PATH`. */
  readonly command?: string;
  /** Environment for the child; defaults to this process's environment. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly signal?: AbortSignal;
}

/**
 * Wrap any process runner into a {@link DenoRunner}. A command that cannot
 * be started becomes a failed result with the error as its stderr, so the
 * extractor reports it as a diagnostic instead of throwing.
 */
export function createSpawnDenoRunner(
  spawn: SpawnFunction,
  options: SpawnDenoRunnerOptions = {},
): DenoRunner {
  const command = options.command ?? "deno";
  return {
    async run(request) {
      let result: SpawnResult;
      try {
        result = await spawn({
          command,
          args: [...request.args],
          cwd: request.projectRoot,
          env: { ...(options.env ?? process.env), NO_COLOR: "1" },
          stdin: "",
          signal: options.signal,
        });
      } catch (error) {
        return {
          exitCode: 1,
          stdout: "",
          stderr: stripAnsi(
            error instanceof Error ? error.message : String(error),
          ),
        };
      }
      return {
        exitCode: result.exitCode ?? 1,
        stdout: result.stdout,
        stderr: stripAnsi(result.stderr),
      };
    },
  };
}

export interface LocalDenoRunnerOptions {
  /** The `deno` executable to run; defaults to whatever `PATH` resolves. */
  readonly binary?: string;
  /** Upper bound on `deno doc` output in bytes. */
  readonly maxOutputBytes?: number;
}

/** Run the `deno` binary installed on this machine through `node:child_process`. */
export function createLocalDenoRunner(
  options: LocalDenoRunnerOptions = {},
): DenoRunner {
  const maxBuffer = options.maxOutputBytes ?? 256 * 1024 * 1024;
  const spawnWithNode: SpawnFunction = (request) =>
    new Promise((resolve, reject) => {
      execFile(
        request.command,
        [...request.args],
        {
          cwd: request.cwd,
          env: { ...request.env } as NodeJS.ProcessEnv,
          maxBuffer,
          signal: request.signal,
        },
        (error, stdout, stderr) => {
          if (error === null) {
            resolve({ exitCode: 0, stdout, stderr });
          } else if (typeof error.code === "number") {
            resolve({ exitCode: error.code, stdout, stderr });
          } else {
            reject(error);
          }
        },
      );
    });
  return createSpawnDenoRunner(spawnWithNode, { command: options.binary });
}

/** Deno colours its warnings even when `NO_COLOR` is set; diagnostics carry plain text. */
function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE, "");
}

const ANSI_ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
