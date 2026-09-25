import {
  type AccessControl,
  generateGo,
  generatePython,
  generateSwift,
  generateTypescript,
} from "@supabase/postgrest-typegen";
import type {
  ChoiceOptionSpec,
  OptionSpec,
  TypegenLanguage,
} from "../contract.ts";
import { dart } from "./dart.ts";
import { inProcessLanguage } from "./in-process.ts";

/** File name handed to `Host.format` for TypeScript output. */
export const TYPESCRIPT_FILE_NAME = "output.ts";

const DETECT_ONE_TO_ONE_RELATIONSHIPS = "detect-one-to-one-relationships";
const POSTGREST_VERSION = "postgrest-version";
const DEFAULT_SCHEMA = "default-schema";
const SWIFT_ACCESS_CONTROL = "swift-access-control";

/**
 * All three are consumer options: the calling program knows the target's
 * PostgREST version, so it decides whether one-to-one relationships can be
 * detected (PostgREST 10 and later), which version to emit and which schema
 * the helper types default to. `supabase gen types` used to expose the first
 * inverted as `--postgrest-v9-compat`, usable only with `--db-url`; its
 * adapter maps that deprecated flag onto this option.
 */
const typescriptOptions: readonly OptionSpec[] = [
  {
    name: DETECT_ONE_TO_ONE_RELATIONSHIPS,
    audience: "consumer",
    kind: "boolean",
    default: true,
    help: "Mark one-to-one relationships so supabase-js types those joins as objects. Turn off for PostgREST 9 and below, which return them as arrays.",
  },
  {
    name: POSTGREST_VERSION,
    audience: "consumer",
    kind: "string",
    help: "PostgREST version of the target project, emitted as __InternalSupabase.PostgrestVersion so supabase-js picks matching options.",
  },
  {
    name: DEFAULT_SCHEMA,
    audience: "consumer",
    kind: "string",
    default: "public",
    help: "Schema the generated Tables, Views, Enums and CompositeTypes helper types default to.",
  },
];

export const typescript = inProcessLanguage(
  "typescript",
  typescriptOptions,
  (metadata, options, host) => {
    const { format } = host;
    const postgrestVersion = options[POSTGREST_VERSION];
    return generateTypescript(metadata, {
      detectOneToOneRelationships:
        options[DETECT_ONE_TO_ONE_RELATIONSHIPS] === true,
      ...(typeof postgrestVersion === "string" ? { postgrestVersion } : {}),
      defaultSchema: options[DEFAULT_SCHEMA] as string,
      ...(format
        ? {
            format: (code: string) => format(code, TYPESCRIPT_FILE_NAME),
          }
        : {}),
    });
  },
);

export const go = inProcessLanguage("go", [], (metadata) =>
  generateGo(metadata),
);

export const python = inProcessLanguage("python", [], (metadata) =>
  generatePython(metadata),
);

/**
 * All four levels the generator accepts. `supabase gen types` used to offer
 * only `internal` and `public`; postgres-meta's route has always accepted
 * all four, and adding choices changes nothing for existing users.
 */
const swiftAccessControl = {
  name: SWIFT_ACCESS_CONTROL,
  audience: "user",
  kind: "choice",
  choices: ["internal", "public", "private", "package"],
  default: "internal",
  help: "Access control for Swift generated types.",
} satisfies ChoiceOptionSpec;

export const swift = inProcessLanguage(
  "swift",
  [swiftAccessControl],
  (metadata, options) =>
    generateSwift(metadata, {
      accessControl: options[SWIFT_ACCESS_CONTROL] as AccessControl,
    }),
);

/**
 * Every language `supabase gen types --lang` accepts, in the order a consumer
 * should list them. In-process entries call the generators bundled in
 * `@supabase/postgrest-typegen`; out-of-process entries run the language's
 * own tool. Adding a language is adding an entry here.
 */
export const languages: readonly TypegenLanguage[] = [
  typescript,
  go,
  python,
  swift,
  dart,
];

/** Looks a language up by its `--lang` name. */
export function findLanguage(name: string): TypegenLanguage | undefined {
  return languages.find((language) => language.name === name);
}
