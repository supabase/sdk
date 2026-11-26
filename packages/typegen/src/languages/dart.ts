import { externalLanguage } from "./external.ts";

const PACKAGE = "supabase_typegen";

/**
 * Dart runs `dart run supabase_typegen` in the user's project, so the version
 * of the generator is the one the project depends on and the output is
 * formatted for the project's own Dart language version. The tool reads the
 * document from stdin when no connection flag is given and writes the code to
 * stdout for `--output -`, keeping its summary on stderr. No `--schema` is
 * passed: the document already holds exactly the schemas the consumer
 * introspected, and the tool generates all of them.
 */
export const dart = externalLanguage("dart", [], {
  command: "dart",
  args: () => ["run", PACKAGE, "--output", "-"],
  installHint:
    "Install the Dart SDK (https://dart.dev/get-dart) or Flutter and make sure `dart` is on PATH.",
  classify: (result) => {
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
    if (result.exitCode === 65) {
      return { kind: "metadata-rejected" };
    }
    return undefined;
  },
});
