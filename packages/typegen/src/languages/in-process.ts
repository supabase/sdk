import {
  type GeneratorMetadata,
  sortGeneratorMetadata,
} from "@supabase/postgrest-typegen";
import type {
  Host,
  OptionSpec,
  ResolvedOptions,
  TypegenLanguage,
} from "../contract.ts";
import { resolveOptions } from "../options.ts";

type Run = (
  metadata: GeneratorMetadata,
  options: ResolvedOptions,
  host: Host,
) => Promise<string> | string;

/**
 * Builds a registry entry around a generator function that runs in this
 * process. Options are resolved and the metadata sorted before `run` sees
 * them.
 *
 * The bundled generators return their template without a final newline;
 * `supabase gen types` has always emitted one (pg-meta printed through
 * `console.log`), so it is appended here and every language's result is a
 * complete file.
 */
export function inProcessLanguage(
  name: string,
  options: readonly OptionSpec[],
  run: Run,
): TypegenLanguage {
  return {
    name,
    inProcess: true,
    options,
    async generate(metadata, values, host) {
      const resolved = resolveOptions(name, options, values);
      const code = await run(sortGeneratorMetadata(metadata), resolved, host);
      return `${code}\n`;
    },
  };
}
