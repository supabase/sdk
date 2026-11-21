import { sortGeneratorMetadata, } from "@supabase/postgrest-typegen";
import { resolveOptions } from "../options.js";
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
export function inProcessLanguage(name, options, run) {
    return {
        name,
        inProcess: true,
        options,
        async generate(metadata, values, host) {
            const resolved = resolveOptions(name, options, values);
            const code = await run(sortGeneratorMetadata(metadata), resolved, host);
            return code.endsWith("\n") ? code : `${code}\n`;
        },
    };
}
