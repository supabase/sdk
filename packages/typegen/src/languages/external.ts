import {
  type GeneratorMetadata,
  serializeGeneratorMetadata,
  sortGeneratorMetadata,
} from "@supabase/postgrest-typegen";
import type {
  OptionSpec,
  ResolvedOptions,
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

const isCommandNotFound = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "ENOENT";

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
      const command = [tool.command, ...args];
      const { spawn } = host;
      if (spawn === undefined) {
        throw new SpawnUnavailableError({
          language: name,
          tool: tool.command,
          message: `Generating ${name} types runs \`${command.join(" ")}\`, but this host cannot run processes. Offer only languages whose \`inProcess\` is true here.`,
        });
      }
      let result: SpawnResult;
      try {
        result = await spawn({
          command: tool.command,
          args,
          cwd: host.cwd,
          env: host.env,
          stdin: serializeGeneratorMetadata(sorted),
          signal: host.signal,
        });
      } catch (error) {
        if (isCommandNotFound(error)) {
          throw new ToolNotInstalledError({
            language: name,
            tool: tool.command,
            installHint: tool.installHint,
            message: `Generating ${name} types needs \`${tool.command}\`, which was not found on PATH. ${tool.installHint}`,
            cause: error,
          });
        }
        throw error;
      }
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
          throw new ToolFailedError({
            language: name,
            command,
            exitCode: result.exitCode,
            stderr,
            message: `\`${commandLine}\` ${
              result.exitCode === null
                ? "was terminated by a signal"
                : `exited with code ${result.exitCode}`
            }.${stderr ? `\n${stderr}` : ""}`,
          });
      }
    },
  };
}
