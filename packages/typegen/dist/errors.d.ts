interface TypegenErrorInit {
    readonly language: string;
    readonly message: string;
    readonly cause?: unknown;
}
/** Base class of every failure the registry raises itself. */
export declare class TypegenError extends Error {
    readonly language: string;
    constructor({ language, message, cause }: TypegenErrorInit);
}
/** An option value was not accepted by the language's `OptionSpec`. */
export declare class InvalidOptionError extends TypegenError {
    readonly option: string;
    constructor(init: TypegenErrorInit & {
        readonly option: string;
    });
}
/**
 * The toolchain or package an out-of-process generator needs is not
 * available in the host's `cwd`. `installHint` tells the user how to fix it.
 */
export declare class ToolNotInstalledError extends TypegenError {
    readonly tool: string;
    readonly installHint: string;
    constructor(init: TypegenErrorInit & {
        readonly tool: string;
        readonly installHint: string;
    });
}
/**
 * An out-of-process language was asked to generate through a `Host` without
 * `spawn`. Hosted consumers avoid this by offering only `inProcess` languages.
 */
export declare class SpawnUnavailableError extends TypegenError {
    readonly tool: string;
    constructor(init: TypegenErrorInit & {
        readonly tool: string;
    });
}
/** An out-of-process generator exited unsuccessfully. */
export declare class ToolFailedError extends TypegenError {
    readonly command: readonly string[];
    readonly exitCode: number | null;
    readonly stderr: string;
    constructor(init: TypegenErrorInit & {
        readonly command: readonly string[];
        readonly exitCode: number | null;
        readonly stderr: string;
    });
}
/**
 * An out-of-process generator refused the `GeneratorMetadata` document,
 * typically because it does not understand this `GENERATOR_METADATA_VERSION`.
 * Usually resolved by updating the tool or the consumer so both agree.
 */
export declare class MetadataRejectedError extends ToolFailedError {
    readonly version: number;
    constructor(init: ConstructorParameters<typeof ToolFailedError>[0] & {
        readonly version: number;
    });
}
export {};
