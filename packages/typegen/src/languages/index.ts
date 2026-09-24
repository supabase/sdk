import {
  generateGo,
  generatePython,
  generateSwift,
  generateTypescript,
} from "@supabase/postgrest-typegen";
import type { ChoiceOptionSpec, TypegenLanguage } from "../contract.ts";
import { dart } from "./dart.ts";
import { inProcessLanguage } from "./in-process.ts";

/** File name handed to `Host.format` for TypeScript output. */
export const TYPESCRIPT_FILE_NAME = "output.ts";

const POSTGREST_V9_COMPAT = "postgrest-v9-compat";
const SWIFT_ACCESS_CONTROL = "swift-access-control";

/**
 * `supabase gen types` exposes the generator's `detectOneToOneRelationships`
 * inverted, as compatibility with PostgREST v9 and below, so the flag keeps
 * that name and polarity.
 */
export const typescript = inProcessLanguage(
  "typescript",
  [
    {
      name: POSTGREST_V9_COMPAT,
      kind: "boolean",
      default: false,
      help: "Generate types compatible with PostgREST v9 and below.",
    },
  ],
  (metadata, options, host) => {
    const { format } = host;
    return generateTypescript(metadata, {
      detectOneToOneRelationships: options[POSTGREST_V9_COMPAT] !== true,
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
 * The Swift generator also accepts `private` and `package`; the flag keeps
 * the two levels `supabase gen types` has always offered.
 */
const swiftAccessControl = {
  name: SWIFT_ACCESS_CONTROL,
  kind: "choice",
  choices: ["internal", "public"],
  default: "internal",
  help: "Access control for Swift generated types.",
} satisfies ChoiceOptionSpec;

export const swift = inProcessLanguage(
  "swift",
  [swiftAccessControl],
  (metadata, options) =>
    generateSwift(metadata, {
      accessControl: options[SWIFT_ACCESS_CONTROL] as "internal" | "public",
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
