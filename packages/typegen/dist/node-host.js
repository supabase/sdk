import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { win32 as windowsPath } from "node:path";
const WINDOWS_SCRIPT_EXTENSIONS = new Set([".bat", ".cmd"]);
const DEFAULT_PATHEXT = ".COM;.EXE;.BAT;.CMD";
/** Environment lookup that ignores key case, as Windows does. */
const envValue = (env, name) => {
    const wanted = name.toLowerCase();
    const key = Object.keys(env).find((candidate) => candidate.toLowerCase() === wanted);
    return key === undefined ? undefined : env[key];
};
const hasDirectory = (command) => windowsPath.isAbsolute(command) ||
    command.includes("\\") ||
    command.includes("/");
/** Whether `file` is a `.bat` or `.cmd` script, which only the command interpreter can start. */
export const isWindowsScript = (file) => WINDOWS_SCRIPT_EXTENSIONS.has(windowsPath.extname(file).toLowerCase());
/**
 * Finds `command` the way cmd.exe would, through `PATH` and `PATHEXT`.
 * Node's `spawn` does neither without a shell, and it refuses to start `.bat`
 * and `.cmd` files, which is how Flutter ships `dart` on Windows.
 */
export function resolveWindowsCommand(command, env, exists = existsSync) {
    const directories = hasDirectory(command)
        ? [""]
        : (envValue(env, "PATH") ?? "").split(";").filter(Boolean);
    const names = windowsPath.extname(command)
        ? [command]
        : (envValue(env, "PATHEXT") ?? DEFAULT_PATHEXT)
            .split(";")
            .filter(Boolean)
            .map((extension) => command + extension);
    for (const directory of directories) {
        for (const name of names) {
            const candidate = directory ? windowsPath.join(directory, name) : name;
            if (exists(candidate)) {
                return candidate;
            }
        }
    }
    return undefined;
}
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
export const quoteForCmd = (token) => {
    if (/["\r\n]/.test(token)) {
        throw new Error(`cannot pass ${JSON.stringify(token)} to cmd.exe: a double quote or line break in a command-line token cannot be escaped`);
    }
    if (token !== "" && !/[\s&|<>^()!,;=]/.test(token)) {
        return token;
    }
    return `"${token.replace(/(\\+)$/, "$1$1")}"`;
};
/**
 * Decides how to start `command`. Everywhere but Windows that is the command
 * as given, so a missing executable surfaces as Node's own `ENOENT`. On
 * Windows the command is resolved through `PATH` and `PATHEXT` first, and a
 * `.bat` or `.cmd` script is run through the command interpreter, since
 * `spawn` cannot start those directly. Returns `undefined` when the Windows
 * lookup finds nothing and throws when a token cannot be quoted for cmd.exe,
 * see `quoteForCmd`.
 */
export function planSpawn(command, args, env, platform = process.platform, exists = existsSync) {
    if (platform !== "win32") {
        return { command, args };
    }
    const resolved = resolveWindowsCommand(command, env, exists);
    if (resolved === undefined) {
        return undefined;
    }
    if (!isWindowsScript(resolved)) {
        return { command: resolved, args };
    }
    const commandLine = [resolved, ...args].map(quoteForCmd).join(" ");
    return {
        command: envValue(env, "ComSpec") ?? "cmd.exe",
        args: ["/d", "/s", "/c", `"${commandLine}"`],
        windowsVerbatimArguments: true,
    };
}
const commandNotFound = (command) => Object.assign(new Error(`spawn ${command} ENOENT`), {
    code: "ENOENT",
    syscall: `spawn ${command}`,
    path: command,
});
function spawnWithNode(request) {
    return new Promise((resolve, reject) => {
        const plan = planSpawn(request.command, request.args, request.env);
        if (plan === undefined) {
            reject(commandNotFound(request.command));
            return;
        }
        const child = spawn(plan.command, [...plan.args], {
            cwd: request.cwd,
            env: { ...request.env },
            stdio: ["pipe", "pipe", "pipe"],
            signal: request.signal,
            windowsVerbatimArguments: plan.windowsVerbatimArguments,
        });
        const stdout = [];
        const stderr = [];
        child.stdout.on("data", (chunk) => stdout.push(chunk));
        child.stderr.on("data", (chunk) => stderr.push(chunk));
        child.on("error", reject);
        child.on("close", (exitCode) => {
            resolve({
                exitCode,
                stdout: Buffer.concat(stdout).toString("utf8"),
                stderr: Buffer.concat(stderr).toString("utf8"),
            });
        });
        // A tool that exits before reading its input closes the pipe early; the
        // exit code and stderr already explain that, so the write error is noise.
        child.stdin.on("error", () => { });
        child.stdin.end(request.stdin);
    });
}
/**
 * A `Host` backed by `node:child_process`, for consumers without their own
 * process runner and for exercising out-of-process entries against a real
 * tool in tests.
 */
export function createNodeHost(options) {
    const host = {
        cwd: options.cwd,
        env: options.env ?? process.env,
        signal: options.signal,
        spawn: spawnWithNode,
    };
    if (options.format) {
        return { ...host, format: options.format };
    }
    return host;
}
