import type { TypegenLanguage } from "../contract.ts";
/** File name handed to `Host.format` for TypeScript output. */
export declare const TYPESCRIPT_FILE_NAME = "output.ts";
export declare const typescript: TypegenLanguage;
export declare const go: TypegenLanguage;
export declare const python: TypegenLanguage;
/**
 * Every language `supabase gen types --lang` accepts, in the order a consumer
 * should list them. In-process entries call the generators bundled in
 * `@supabase/postgrest-typegen`; out-of-process entries run the language's
 * own tool. Adding a language is adding an entry here.
 */
export declare const languages: readonly TypegenLanguage[];
/** Looks a language up by its `--lang` name. */
export declare function findLanguage(name: string): TypegenLanguage | undefined;
