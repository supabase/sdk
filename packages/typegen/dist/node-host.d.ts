import type { Host } from "./contract.ts";
export interface NodeHostOptions {
    readonly cwd: string;
    /** Defaults to `process.env`. */
    readonly env?: Readonly<Record<string, string | undefined>>;
    readonly signal?: AbortSignal;
    readonly format?: Host["format"];
}
type Env = Readonly<Record<string, string | undefined>>;
/** What `planSpawn` decided to hand to `child_process.spawn`. */
export interface SpawnPlan {
    readonly command: string;
    readonly args: readonly string[];
    readonly windowsVerbatimArguments?: boolean;
}
/** Whether `file` is a `.bat` or `.cmd` script, which only the command interpreter can start. */
export declare const isWindowsScript: (file: string) => boolean;
/**
 * Finds `command` the way cmd.exe would, through `PATH` and `PATHEXT`.
 * Node's `spawn` does neither without a shell, and it refuses to start `.bat`
 * and `.cmd` files, which is how Flutter ships `dart` on Windows.
 */
export declare function resolveWindowsCommand(command: string, env: Env, exists?: (path: string) => boolean): string | undefined;
/**
 * Quotes one token of a `cmd.exe /c` command line. Whitespace, the
 * interpreter's metacharacters and the batch parameter delimiters `,;=` are
 * literal inside double quotes; a trailing backslash is doubled so it cannot
 * escape the closing quote. A token holding a double quote or a line break is
 * refused: cmd.exe toggles quoting on every `"` whatever precedes it, so the
 * rest of the line would become command syntax, and no escape exists. `%VAR%`
 * (and `!VAR!` under delayed expansion) still expands inside quotes, so a path
 * holding `%` cannot be passed reliably. Hosts that run a Windows script
 * through a shell should quote with this so every host builds the same line.
 */
export declare const quoteForCmd: (token: string) => string;
/**
 * Decides how to start `command`. Everywhere but Windows that is the command
 * as given, so a missing executable surfaces as Node's own `ENOENT`. On
 * Windows the command is resolved through `PATH` and `PATHEXT` first, and a
 * `.bat` or `.cmd` script is run through the command interpreter, since
 * `spawn` cannot start those directly. Returns `undefined` when the Windows
 * lookup finds nothing and throws when a token cannot be quoted for cmd.exe,
 * see `quoteForCmd`.
 */
export declare function planSpawn(command: string, args: readonly string[], env: Env, platform?: NodeJS.Platform, exists?: (path: string) => boolean): SpawnPlan | undefined;
/**
 * A `Host` backed by `node:child_process`, for consumers without their own
 * process runner and for exercising out-of-process entries against a real
 * tool in tests.
 */
export declare function createNodeHost(options: NodeHostOptions): Host;
export {};
