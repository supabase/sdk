import { type GeneratorMetadata } from "@supabase/postgrest-typegen";
import type { OptionSpec, ResolvedOptions, SpawnResult, TypegenLanguage } from "../contract.ts";
/**
 * How a language entry explains a non-zero exit of its tool. Anything it does
 * not recognize becomes a plain `ToolFailedError`.
 */
type ToolFailure = {
    readonly kind: "not-installed";
    readonly tool: string;
    readonly installHint: string;
} | {
    readonly kind: "metadata-rejected";
};
/** Describes the command line of a generator that runs outside this process. */
export interface ExternalTool {
    /** Executable resolved against `PATH`, for example `dart`. */
    readonly command: string;
    /** Arguments after `command`; receives the sorted metadata being sent. */
    args(metadata: GeneratorMetadata, options: ResolvedOptions): readonly string[];
    /** Shown when `command` itself cannot be found. */
    readonly installHint: string;
    /** Classifies a non-zero exit; return `undefined` for a generic failure. */
    classify?(result: SpawnResult): ToolFailure | undefined;
}
/**
 * Builds a registry entry that runs `tool` in the host's `cwd` with the
 * serialized, sorted metadata on stdin and returns the tool's stdout, which
 * is the complete generated file, verbatim.
 */
export declare function externalLanguage(name: string, options: readonly OptionSpec[], tool: ExternalTool): TypegenLanguage;
export {};
