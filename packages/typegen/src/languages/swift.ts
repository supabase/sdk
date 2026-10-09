import type { ChoiceOptionSpec } from "../contract.ts";
import { externalLanguage } from "./external.ts";

const SWIFT_ACCESS_CONTROL = "swift-access-control";

/**
 * The flag `supabase gen types` already exposes, narrowed to the two levels
 * `supabase-typegen` accepts. The in-process generator it replaces also took
 * `private` and `package`; those now fail validation before anything runs.
 */
const swiftAccessControl = {
  name: SWIFT_ACCESS_CONTROL,
  audience: "user",
  kind: "choice",
  choices: ["internal", "public"],
  default: "internal",
  help: "Access control for Swift generated types.",
} satisfies ChoiceOptionSpec;

/**
 * Swift runs the prebuilt `supabase-typegen` executable from supabase-swift,
 * which reads the document on stdin and writes one file of `@Table` structs to
 * stdout. It is a binary on PATH, not a package dependency, because its
 * swift-format dependency would pin every app's swift-syntax, and because an
 * Xcode project without a `Package.swift` has nothing to `swift run` from. No
 * `--schema` is passed: the document already holds exactly the schemas the
 * consumer introspected, and the tool generates all of them.
 */
export const swift = externalLanguage("swift", [swiftAccessControl], {
  command: "supabase-typegen",
  args: (_metadata, options) => [
    "--access-control",
    options[SWIFT_ACCESS_CONTROL] as string,
  ],
  installHint:
    "Download `supabase-typegen` from the supabase-swift release that matches the version your project depends on (https://github.com/supabase/supabase-swift/releases) and put it on PATH.",
  classify: (result) =>
    result.exitCode === 65 ? { kind: "metadata-rejected" } : undefined,
});
