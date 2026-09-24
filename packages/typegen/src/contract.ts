import type { GeneratorMetadata } from "@supabase/postgrest-typegen";

/**
 * A request to run an out-of-process generator. The registry fills every
 * field; the host only executes it.
 */
export interface SpawnRequest {
  /** Executable name, resolved against `PATH` by the host (for example `dart`). */
  readonly command: string;
  readonly args: readonly string[];
  /** Directory to run in; always the host's `cwd`, the user's project. */
  readonly cwd: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Complete document to write to the child's stdin before closing it. */
  readonly stdin: string;
  readonly signal?: AbortSignal;
}

/** What a spawned generator produced once it exited. */
export interface SpawnResult {
  /** Exit code, or `null` when the process was ended by a signal. */
  readonly exitCode: number | null;
  /** Everything the tool wrote to stdout, decoded as UTF-8. */
  readonly stdout: string;
  /** Everything the tool wrote to stderr, decoded as UTF-8. */
  readonly stderr: string;
}

/**
 * The environment a consumer (the Supabase CLI, postgres-meta, a test) hands
 * to every `generate` call. Introspection is deliberately not part of it:
 * the caller runs `introspect()` from `@supabase/postgrest-typegen` itself and
 * passes the resulting metadata in.
 */
export interface Host {
  /**
   * The user's project directory. Out-of-process generators run here so they
   * resolve the project's own toolchain and dependencies.
   */
  readonly cwd: string;
  /** Environment for spawned generators, usually the consumer's `process.env`. */
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Aborting it cancels the in-flight generation and kills any spawned tool. */
  readonly signal?: AbortSignal;
  /**
   * Runs an out-of-process generator to completion. Must reject with an error
   * whose `code` is `"ENOENT"` when `request.command` cannot be found, which
   * is what Node's `child_process` reports; the registry turns that into a
   * `ToolNotInstalledError` carrying the language's install hint. Any other
   * outcome, including a non-zero exit, resolves normally.
   */
  spawn(request: SpawnRequest): Promise<SpawnResult>;
  /**
   * Replaces the formatter of in-process generators that format their own
   * output. Today only TypeScript does, through `oxfmt`, and the file name is
   * `output.ts`. Leave it out to keep each generator's default formatter;
   * pass an identity function to receive the unformatted template output,
   * which is what the Supabase CLI does to keep `oxfmt` out of its bundle.
   */
  readonly format?: (code: string, fileName: string) => Promise<string>;
}

/**
 * Who sets an option. `user` options are the language's CLI flags. `consumer`
 * options are set by the calling program from its own configuration, for
 * example postgres-meta passing the project's PostgREST version, and are never
 * shown to users; a consumer renders `options` filtered to `user`.
 */
export type OptionAudience = "user" | "consumer";

interface OptionSpecBase {
  /**
   * The flag name exactly as the CLI exposes it, without the leading dashes,
   * for example `swift-access-control`. Also the key in `OptionValues`.
   * Consumer options use the same form so one can become a flag later.
   */
  readonly name: string;
  readonly audience: OptionAudience;
  /** One-line help text for the flag. */
  readonly help: string;
}

export interface BooleanOptionSpec extends OptionSpecBase {
  readonly kind: "boolean";
  readonly default: boolean;
}

export interface StringOptionSpec extends OptionSpecBase {
  readonly kind: "string";
  readonly default?: string;
}

export interface ChoiceOptionSpec extends OptionSpecBase {
  readonly kind: "choice";
  readonly choices: readonly string[];
  readonly default: string;
}

/**
 * Declarative description of one language-specific flag, so a consumer can
 * render every language's flags without knowing the languages.
 */
export type OptionSpec =
  | BooleanOptionSpec
  | StringOptionSpec
  | ChoiceOptionSpec;

export type OptionValue = string | boolean;

/**
 * Option values keyed by `OptionSpec.name`. Missing keys take the spec's
 * default; `generate` rejects unknown names and values outside a choice's
 * `choices` with an `InvalidOptionError`.
 */
export type OptionValues = Readonly<Record<string, OptionValue | undefined>>;

/** `OptionValues` after defaults were applied and every value was validated. */
export type ResolvedOptions = Readonly<Record<string, OptionValue>>;

/** One `--lang` value of `supabase gen types`. */
export interface TypegenLanguage {
  /** What `--lang` accepts, for example `dart`. */
  readonly name: string;
  /**
   * `true` when the generator is a function called in this process. `false`
   * when a toolchain outside the consumer runs it, which hosted consumers such
   * as postgres-meta's `/generators/*` routes cannot offer.
   */
  readonly inProcess: boolean;
  /** Language-specific flags; empty when the language has none. */
  readonly options: readonly OptionSpec[];
  /**
   * Generates source code for `metadata`. The metadata may be unsorted; the
   * registry applies `sortGeneratorMetadata` itself so output is
   * deterministic. Returns the complete contents of the generated file,
   * ready to be written as-is, for every language.
   */
  generate(
    metadata: GeneratorMetadata,
    options: OptionValues,
    host: Host,
  ): Promise<string>;
}
