import type { OptionSpec, OptionValues, ResolvedOptions } from "./contract.ts";
/**
 * Applies the defaults of `specs` to `values` and validates every value.
 * Throws an `InvalidOptionError` for a name no spec declares or a value the
 * spec does not accept. Every `TypegenLanguage.generate` runs this first, so
 * consumers may pass only the options the user set.
 */
export declare function resolveOptions(language: string, specs: readonly OptionSpec[], values: OptionValues): ResolvedOptions;
