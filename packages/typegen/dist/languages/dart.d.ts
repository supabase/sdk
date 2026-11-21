/**
 * Dart runs `dart run supabase_typegen` in the user's project, so the version
 * of the generator is the one the project depends on and the output is
 * formatted for the project's own Dart language version. The tool reads the
 * document from stdin when no connection flag is given and writes the code to
 * stdout for `--output -`, keeping its summary on stderr. No `--schema` is
 * passed: the document already holds exactly the schemas the consumer
 * introspected, and the tool generates all of them.
 */
export declare const dart: import("../contract.ts").TypegenLanguage;
