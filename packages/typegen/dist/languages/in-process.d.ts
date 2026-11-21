import { type GeneratorMetadata } from "@supabase/postgrest-typegen";
import type { Host, OptionSpec, ResolvedOptions, TypegenLanguage } from "../contract.ts";
type Run = (metadata: GeneratorMetadata, options: ResolvedOptions, host: Host) => Promise<string> | string;
/**
 * Builds a registry entry around a generator function that runs in this
 * process. Options are resolved and the metadata sorted before `run` sees
 * them.
 *
 * The bundled generators return the complete file, final newline included,
 * and the result is passed on verbatim. A newline is added only when it is
 * missing, which happens when a `Host.format` implementation strips it from
 * TypeScript output.
 */
export declare function inProcessLanguage(name: string, options: readonly OptionSpec[], run: Run): TypegenLanguage;
export {};
