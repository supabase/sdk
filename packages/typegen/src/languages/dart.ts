import type { BooleanOptionSpec, StringOptionSpec } from "../contract.ts";
import { externalLanguage } from "./external.ts";

const PACKAGE = "supabase_typegen";
const SET_EXIT_IF_CHANGED = "dart-set-exit-if-changed";
const OUTPUT = "dart-output";

const setExitIfChanged = {
  name: SET_EXIT_IF_CHANGED,
  audience: "user",
  kind: "boolean",
  default: false,
  help: "Write nothing and fail when the Dart file at --dart-output differs from the generated code.",
} satisfies BooleanOptionSpec;

const output = {
  name: OUTPUT,
  audience: "user",
  kind: "string",
  default: "lib/supabase_schema.g.dart",
  help: "The generated Dart file that --dart-set-exit-if-changed compares with.",
} satisfies StringOptionSpec;

/**
 * Dart runs `dart run supabase_typegen` in the user's project, so the version
 * of the generator is the one the project depends on and the output is
 * formatted for the project's own Dart language version. The tool reads the
 * document from stdin when no connection flag is given and writes the code to
 * stdout for `--output -`, keeping its summary on stderr. No `--schema` is
 * passed: the document already holds exactly the schemas the consumer
 * introspected, and the tool generates all of them.
 *
 * With `dart-set-exit-if-changed` the tool compares the code with the file at
 * `dart-output` instead, formatted for that file's project, writes nothing and
 * exits with 1 when they differ.
 */
export const dart = externalLanguage("dart", [setExitIfChanged, output], {
  command: "dart",
  args: (_, options) =>
    options[SET_EXIT_IF_CHANGED]
      ? [
          "run",
          PACKAGE,
          "--output",
          String(options[OUTPUT]),
          "--set-exit-if-changed",
        ]
      : ["run", PACKAGE, "--output", "-"],
  installHint:
    "Install the Dart SDK (https://dart.dev/get-dart) or Flutter and make sure `dart` is on PATH.",
  classify: (result, options) => {
    if (
      result.stderr.includes(`Could not find package \`${PACKAGE}\``) ||
      result.stderr.includes("Found no `pubspec.yaml` file")
    ) {
      return {
        kind: "not-installed",
        tool: `the ${PACKAGE} package`,
        installHint: `Run \`dart pub add --dev ${PACKAGE}\` in the Dart or Flutter project that should receive the types, then generate from that directory.`,
      };
    }
    if (result.exitCode === 1 && options[SET_EXIT_IF_CHANGED]) {
      return { kind: "output-changed", path: String(options[OUTPUT]) };
    }
    if (result.exitCode === 65) {
      return { kind: "metadata-rejected" };
    }
    return undefined;
  },
});
