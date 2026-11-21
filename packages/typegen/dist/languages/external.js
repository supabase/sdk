import { serializeGeneratorMetadata, sortGeneratorMetadata, } from "@supabase/postgrest-typegen";
import { MetadataRejectedError, SpawnUnavailableError, ToolFailedError, ToolNotInstalledError, } from "../errors.js";
import { resolveOptions } from "../options.js";
const isCommandNotFound = (error) => typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT";
/**
 * Builds a registry entry that runs `tool` in the host's `cwd` with the
 * serialized, sorted metadata on stdin and returns the tool's stdout, which
 * is the complete generated file, verbatim.
 */
export function externalLanguage(name, options, tool) {
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
            let result;
            try {
                result = await spawn({
                    command: tool.command,
                    args,
                    cwd: host.cwd,
                    env: host.env,
                    stdin: serializeGeneratorMetadata(sorted),
                    signal: host.signal,
                });
            }
            catch (error) {
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
                        message: `\`${commandLine}\` ${result.exitCode === null
                            ? "was terminated by a signal"
                            : `exited with code ${result.exitCode}`}.${stderr ? `\n${stderr}` : ""}`,
                    });
            }
        },
    };
}
