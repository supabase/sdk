interface TypegenErrorInit {
  readonly language: string;
  readonly message: string;
  readonly cause?: unknown;
}

/** Base class of every failure the registry raises itself. */
export class TypegenError extends Error {
  readonly language: string;

  constructor({ language, message, cause }: TypegenErrorInit) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "TypegenError";
    this.language = language;
  }
}

/** An option value was not accepted by the language's `OptionSpec`. */
export class InvalidOptionError extends TypegenError {
  readonly option: string;

  constructor(init: TypegenErrorInit & { readonly option: string }) {
    super(init);
    this.name = "InvalidOptionError";
    this.option = init.option;
  }
}

/**
 * The toolchain or package an out-of-process generator needs is not
 * available in the host's `cwd`. `installHint` tells the user how to fix it.
 */
export class ToolNotInstalledError extends TypegenError {
  readonly tool: string;
  readonly installHint: string;

  constructor(
    init: TypegenErrorInit & {
      readonly tool: string;
      readonly installHint: string;
    },
  ) {
    super(init);
    this.name = "ToolNotInstalledError";
    this.tool = init.tool;
    this.installHint = init.installHint;
  }
}

/** An out-of-process generator exited unsuccessfully. */
export class ToolFailedError extends TypegenError {
  readonly command: readonly string[];
  readonly exitCode: number | null;
  readonly stderr: string;

  constructor(
    init: TypegenErrorInit & {
      readonly command: readonly string[];
      readonly exitCode: number | null;
      readonly stderr: string;
    },
  ) {
    super(init);
    this.name = "ToolFailedError";
    this.command = init.command;
    this.exitCode = init.exitCode;
    this.stderr = init.stderr;
  }
}

/**
 * An out-of-process generator refused the `GeneratorMetadata` document,
 * typically because it does not understand this `GENERATOR_METADATA_VERSION`.
 * Usually resolved by updating the tool or the consumer so both agree.
 */
export class MetadataRejectedError extends ToolFailedError {
  readonly version: number;

  constructor(
    init: ConstructorParameters<typeof ToolFailedError>[0] & {
      readonly version: number;
    },
  ) {
    super(init);
    this.name = "MetadataRejectedError";
    this.version = init.version;
  }
}
