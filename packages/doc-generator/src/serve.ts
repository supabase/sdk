import { spawn } from "node:child_process";
import { connect } from "node:net";
import { GeneratorError } from "./errors.ts";

/**
 * What starting the docs site needs from the machine. Passed in, so that a
 * test can stand in for processes, ports and the browser.
 */
export interface ServeSystem {
  /** Whether something accepts connections on the host and port of `url`. */
  readonly listening: (url: string) => Promise<boolean>;
  /**
   * Starts `pnpm dev:docs` in a docs checkout, with its output on this
   * terminal. `exited` settles with its exit code once it stops.
   */
  readonly startDocs: (checkout: string) => {
    readonly exited: Promise<number>;
  };
  readonly openBrowser: (url: string) => void;
  readonly wait: (milliseconds: number) => Promise<void>;
}

/**
 * Starts the docs site of a checkout and opens `url` in a browser once the
 * site accepts connections. Resolves with the exit code of the site when it
 * stops, which is when the person running it presses Ctrl-C.
 *
 * When something already listens on the port, that is taken to be the docs
 * site, and only the page is opened.
 */
export async function serveDocs(
  checkout: string,
  url: string,
  system: ServeSystem,
  say: (text: string) => void,
): Promise<number> {
  if (await system.listening(url)) {
    say(`The docs site already runs. Opening ${url}\n`);
    system.openBrowser(url);
    return 0;
  }
  say(`Starting the docs site: pnpm dev:docs in ${checkout}\n`);
  const site = system.startDocs(checkout);
  let stopped = false;
  const done = site.exited.finally(() => {
    stopped = true;
  });
  // `done` is returned below. Until then, this keeps a site that fails to
  // start from being reported as an unhandled rejection.
  done.catch(() => undefined);
  while (!stopped && !(await system.listening(url))) {
    await system.wait(1000);
  }
  // A site that stopped before it listened has nothing to open. Its own
  // output says why.
  if (!stopped) {
    say(`Opening ${url}. Stop the docs site with Ctrl-C.\n`);
    system.openBrowser(url);
  }
  return done;
}

const BROWSER_OPENERS: Partial<Record<NodeJS.Platform, string>> = {
  darwin: "open",
  win32: "explorer",
};

/** The machine this runs on. */
export const localSystem: ServeSystem = {
  listening: (url) =>
    new Promise((resolve) => {
      const { hostname, port } = new URL(url);
      const socket = connect({ host: hostname, port: Number(port) });
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    }),
  startDocs: (checkout) => {
    const site = spawn("pnpm", ["dev:docs"], {
      cwd: checkout,
      stdio: "inherit",
    });
    return {
      exited: new Promise((resolve, reject) => {
        site.once("error", (error: NodeJS.ErrnoException) => {
          reject(
            error.code === "ENOENT"
              ? new GeneratorError(
                  "Cannot start the docs site: pnpm is not installed. Install it, or copy the definitions only with --copy-only.",
                )
              : error,
          );
        });
        site.once("exit", (code) => resolve(code ?? 1));
      }),
    };
  },
  openBrowser: (url) => {
    const opener = BROWSER_OPENERS[process.platform] ?? "xdg-open";
    spawn(opener, [url], { stdio: "ignore", detached: true }).unref();
  },
  wait: (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
};
