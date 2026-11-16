import {
  type GeneratorMetadata,
  serializeGeneratorMetadata,
  sortGeneratorMetadata,
} from "@supabase/postgrest-typegen";
import type {
  Host,
  OptionSpec,
  ResolvedOptions,
  SpawnRequest,
  SpawnResult,
  TypegenLanguage,
} from "../contract.ts";
import {
  MetadataRejectedError,
  SpawnUnavailableError,
  ToolFailedError,
  ToolNotInstalledError,
} from "../errors.ts";
import { resolveOptions } from "../options.ts";

/**
 * How a language entry explains a non-zero exit of its tool. Anything it does
 * not recognize becomes a plain `ToolFailedError`.
 */
type ToolFailure =
  | {
      readonly kind: "not-installed";
      readonly tool: string;
      readonly installHint: string;
    }
  | { readonly kind: "metadata-rejected" };

/** Describes the command line of a generator that runs outside this process. */
export interface ExternalTool {
  /** Executable resolved against `PATH`, for example `dart`. */
  readonly command: string;
  /**
   * Finds the executable to run in place of `command`. Called only once the
   * host can spawn, so `command` still names the tool when it cannot.
   */
  resolveCommand?(
    options: ResolvedOptions,
    host: Host,
    spawn: Spawn,
  ): Promise<string>;
  /** Arguments after `command`; receives the sorted metadata being sent. */
  args(
    metadata: GeneratorMetadata,
    options: ResolvedOptions,
  ): readonly string[];
  /** Shown when `command` itself cannot be found. */
  readonly installHint: string;
  /** Classifies a non-zero exit; return `undefined` for a generic failure. */
  classify?(result: SpawnResult): ToolFailure | undefined;
}

type Spawn = NonNullable<Host["spawn"]>;

/** Whether `Host.spawn` rejected because the command is not on PATH. */
const isCommandNotFound = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "ENOENT";

/**
 * Runs `request`, reporting a command that is not on PATH as a
 * `ToolNotInstalledError` that says `step` needs it.
 */
export async function spawnTool(
  spawn: Spawn,
  request: SpawnRequest,
  tool: {
    readonly language: string;
    readonly step: string;
    readonly installHint: string;
  },
): Promise<SpawnResult> {
  try {
    return await spawn(request);
  } catch (error) {
    if (isCommandNotFound(error)) {
      throw new ToolNotInstalledError({
        language: tool.language,
        tool: request.command,
        installHint: tool.installHint,
        message: `${tool.step} needs \`${request.command}\`, which was not found on PATH. ${tool.installHint}`,
        cause: error,
      });
    }
    throw error;
  }
}

/**
 * A non-zero exit of `command` as a `ToolFailedError` whose message ends with
 * stderr. With `step`, the message names the step and also shows stdout.
 */
export function toolFailed(
  language: string,
  command: readonly string[],
  result: SpawnResult,
  step?: string,
): ToolFailedError {
  const stderr = result.stderr.trim();
  const output = [step === undefined ? "" : result.stdout.trim(), stderr]
    .filter(Boolean)
    .join("\n");
  return new ToolFailedError({
    language,
    command,
    exitCode: result.exitCode,
    stderr,
    message: `${step === undefined ? "" : `${step} failed: `}\`${command.join(" ")}\` ${
      result.exitCode === null
        ? "was terminated by a signal"
        : `exited with code ${result.exitCode}`
    }.${output ? `\n${output}` : ""}`,
  });
}

/**
 * Builds a registry entry that runs `tool` in the host's `cwd` with the
 * serialized, sorted metadata on stdin and returns the tool's stdout, which
 * is the complete generated file, verbatim.
 */
export function externalLanguage(
  name: string,
  options: readonly OptionSpec[],
  tool: ExternalTool,
): TypegenLanguage {
  return {
    name,
    inProcess: false,
    options,
    async generate(metadata, values, host) {
      const resolved = resolveOptions(name, options, values);
      const sorted = sortGeneratorMetadata(metadata);
      const args = tool.args(sorted, resolved);
      const { spawn } = host;
      if (spawn === undefined) {
        throw new SpawnUnavailableError({
          language: name,
          tool: tool.command,
          message: `Generating ${name} types runs \`${[tool.command, ...args].join(" ")}\`, but this host cannot run processes. Offer only languages whose \`inProcess\` is true here.`,
        });
      }
      const executable =
        (await tool.resolveCommand?.(resolved, host, spawn)) ?? tool.command;
      const command = [executable, ...args];
      const result = await spawnTool(
        spawn,
        {
          command: executable,
          args,
          cwd: host.cwd,
          env: host.env,
          stdin: serializeGeneratorMetadata(sorted),
          signal: host.signal,
        },
        {
          language: name,
          step: `Generating ${name} types`,
          installHint: tool.installHint,
        },
      );
      if (result.exitCode === 0) {
        return result.stdout;
      }
      const stderr = result.stderr.trim();
      const failure = tool.classify?.(result);
      const commandLine = command.join(" ");
      switch (failure?.kind) {
        case "not-installed":
          throw new ToolNotInstalledError({
            language: name,
            tool: failure.tool,
            installHint: failure.installHint,
            message: `Generating ${name} types needs ${failure.tool}, which \`${commandLine}\` could not find in ${host.cwd}. ${failure.installHint}${stderr ? `\n${stderr}` : ""}`,
          });
        case "metadata-rejected":
          throw new MetadataRejectedError({
            language: name,
            command,
            exitCode: result.exitCode,
            stderr,
            version: sorted.version,
            message: `\`${commandLine}\` rejected the GeneratorMetadata document (version ${sorted.version}). Update the tool and supabase gen types so both agree on the document format.${stderr ? `\n${stderr}` : ""}`,
          });
        default:
          throw toolFailed(name, command, result);
      }
    },
  };
}
