/**
 * Everything a consumer needs from `@supabase/postgrest-typegen` to produce
 * the metadata the registry generates from, re-exported so the consumer
 * depends on this package alone and always introspects with the same
 * postgrest-typegen version the in-process generators were built against.
 */
export {
  GENERATOR_METADATA_VERSION,
  type GeneratorMetadata,
  introspect,
  type IntrospectOptions,
  type Queryable,
} from "@supabase/postgrest-typegen";
export type {
  BooleanOptionSpec,
  ChoiceOptionSpec,
  Host,
  OptionAudience,
  OptionSpec,
  OptionValue,
  OptionValues,
  ResolvedOptions,
  SpawnRequest,
  SpawnResult,
  StringOptionSpec,
  TypegenLanguage,
} from "./contract.ts";
export {
  InvalidOptionError,
  MetadataRejectedError,
  ToolFailedError,
  ToolNotInstalledError,
  TypegenError,
} from "./errors.ts";
export { resolveOptions } from "./options.ts";
export {
  findLanguage,
  go,
  languages,
  python,
  swift,
  typescript,
  TYPESCRIPT_FILE_NAME,
} from "./languages/index.ts";
export { dart } from "./languages/dart.ts";
export {
  createNodeHost,
  type NodeHostOptions,
  planSpawn,
  resolveWindowsCommand,
  type SpawnPlan,
} from "./node-host.ts";
