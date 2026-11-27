/**
 * The API model: what a source adapter hands to the generator. It is one SDK's
 * public API with everything language-specific already resolved, so the code
 * that builds definitions never looks at a symbol graph or a docstring.
 *
 * What counts as public is the adapter's call, in the terms of its language:
 * access control in Swift, `__all__` and underscores in Python. The generator
 * writes a definition for every callable it is handed, documented or not.
 *
 * The model is plain data on purpose. An SDK whose doc tool has no output that
 * can be read from here can have a small tool in its own language write this
 * shape as JSON.
 */
export interface ApiModel {
  /** Code fence language of signatures and examples, such as `swift`. */
  readonly language: string;
  readonly symbols: readonly ApiSymbol[];
}

export type ApiSymbol = CallableSymbol | TypeSymbol | PropertySymbol;

interface SymbolBase {
  /**
   * Unique in the model and the same on every run: the precise identifier in
   * Swift, the canonical path in Python.
   */
  readonly id: string;
  /** Orders symbols the way the source declares them. */
  readonly position: SourcePosition;
}

/**
 * Compared field by field. `file` only has to sort the same way on every
 * machine, so a path with a machine-specific prefix is fine as long as every
 * symbol shares the prefix. It is never written to a definition.
 */
export interface SourcePosition {
  readonly file: string;
  readonly line: number;
  readonly column: number;
}

/**
 * A public function, method or initializer: what a definition is generated
 * from.
 */
export interface CallableSymbol extends SymbolBase {
  readonly kind: "callable";
  /**
   * How the language names the callable, as far out as it takes to tell it
   * from every other one, and without what tells overloads apart:
   * `AuthClient.signUp` in Swift, `supabase_auth.SyncAuthClient.sign_up` in
   * Python. The definition id is this name in lowercase words, so it has to
   * stay the same for as long as the code does. Overloads share one name,
   * and with it one definition.
   */
  readonly name: string;
  /**
   * The module or package the callable belongs to, as the language names it.
   * It groups the definitions: it is their `category`.
   */
  readonly module: string;
  /** Bare name, without parentheses or argument labels. */
  readonly title: string;
  /** Fully qualified name, as specific as the language allows. */
  readonly symbol: string;
  /** The declaration as written in the language. */
  readonly signature: string;
  /**
   * Other ways to write the same call, such as the awaitable form of a method
   * that is declared once for a sync and an async client.
   */
  readonly alternateSignatures: readonly string[];
  readonly doc: ApiDoc;
  readonly parameters: readonly ApiParameter[];
  /** Absent when the callable returns nothing. */
  readonly returns?: ApiType;
  readonly typeParams: readonly string[];
  readonly stability: "stable" | "beta" | "experimental";
  /** Present when deprecated. The message is Markdown. */
  readonly deprecated?: { readonly message?: string };
}

/** A type whose members can be inlined where a parameter uses it. */
export interface TypeSymbol extends SymbolBase {
  readonly kind: "type";
  /** Ids of the `PropertySymbol`s a caller sets, in source order. */
  readonly properties: readonly string[];
}

/** A member of a `TypeSymbol`. */
export interface PropertySymbol extends SymbolBase {
  readonly kind: "property";
  /** Bare member name. */
  readonly title: string;
  readonly type?: ApiType;
  /** Whether the caller must provide it. */
  readonly required: boolean;
  /** Markdown. */
  readonly description: string;
}

export interface ApiType {
  /** The type in the language's own syntax. */
  readonly text: string;
  /**
   * Id of the `TypeSymbol` to inline, set when the type is exactly one type
   * of the SDK (optionally nullable) and nothing else.
   */
  readonly ref?: string;
}

export interface ApiParameter {
  readonly name: string;
  readonly type?: ApiType;
  /** Whether the caller must provide it. */
  readonly required: boolean;
  /** A literal as a JSON scalar, any other expression as source text. */
  readonly default?: string | number | boolean;
  readonly variadic: boolean;
  readonly allowedValues?: readonly (string | number | boolean)[];
  /** Markdown. */
  readonly description: string;
}

export interface ApiDoc {
  /** One line. */
  readonly summary: string;
  /** The whole comment as Markdown, without what has a field of its own. */
  readonly description: string;
  readonly returns?: string;
  readonly throws: readonly ApiThrow[];
  readonly examples: readonly ApiExample[];
}

export interface ApiThrow {
  readonly type?: string;
  readonly description: string;
}

export interface ApiExample {
  /** Absent when the source gives the example no title. */
  readonly title?: string;
  readonly lang: string;
  readonly code: string;
}

const compare = <T extends string | number>(a: T, b: T): number =>
  a < b ? -1 : a > b ? 1 : 0;

/** Source order, with the id as the final tie-break so the order is total. */
export const bySourceOrder = (a: ApiSymbol, b: ApiSymbol): number =>
  compare(a.position.file, b.position.file) ||
  a.position.line - b.position.line ||
  a.position.column - b.position.column ||
  compare(a.id, b.id);
