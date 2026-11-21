/** Base class of every failure the registry raises itself. */
export class TypegenError extends Error {
    language;
    constructor({ language, message, cause }) {
        super(message, cause === undefined ? undefined : { cause });
        this.name = "TypegenError";
        this.language = language;
    }
}
/** An option value was not accepted by the language's `OptionSpec`. */
export class InvalidOptionError extends TypegenError {
    option;
    constructor(init) {
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
    tool;
    installHint;
    constructor(init) {
        super(init);
        this.name = "ToolNotInstalledError";
        this.tool = init.tool;
        this.installHint = init.installHint;
    }
}
/**
 * An out-of-process language was asked to generate through a `Host` without
 * `spawn`. Hosted consumers avoid this by offering only `inProcess` languages.
 */
export class SpawnUnavailableError extends TypegenError {
    tool;
    constructor(init) {
        super(init);
        this.name = "SpawnUnavailableError";
        this.tool = init.tool;
    }
}
/** An out-of-process generator exited unsuccessfully. */
export class ToolFailedError extends TypegenError {
    command;
    exitCode;
    stderr;
    constructor(init) {
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
    version;
    constructor(init) {
        super(init);
        this.name = "MetadataRejectedError";
        this.version = init.version;
    }
}
