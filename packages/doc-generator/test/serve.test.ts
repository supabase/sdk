import { describe, expect, test } from "bun:test";
import { once } from "node:events";
import { type AddressInfo, createServer } from "node:net";
import { GeneratorError } from "../src/errors.ts";
import { localSystem, type ServeSystem, serveDocs } from "../src/serve.ts";

const PAGE = "http://localhost:3001/docs/reference-beta/python";

/**
 * A machine where the docs site listens from the check after `checks` failed
 * ones, and stops when `exited` settles. Records what serving does.
 */
const machine = (checks: number, exited: Promise<number>) => {
  const calls: string[] = [];
  let made = 0;
  const system: ServeSystem = {
    listening: async () => made++ >= checks,
    startDocs: (checkout) => {
      calls.push(`start ${checkout}`);
      return { exited };
    },
    openBrowser: (url) => {
      calls.push(`open ${url}`);
    },
    wait: async () => {
      calls.push("wait");
    },
  };
  return { system, calls };
};

const quiet = (): undefined => undefined;

/** Lets every pending step of an async function run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("serveDocs", () => {
  test("only opens the page when the docs site already runs", async () => {
    const { system, calls } = machine(0, new Promise(() => undefined));
    expect(await serveDocs("/docs", PAGE, system, quiet)).toBe(0);
    expect(calls).toEqual([`open ${PAGE}`]);
  });

  test("starts the docs site, opens the page once it listens, and ends with it", async () => {
    const site = Promise.withResolvers<number>();
    const { system, calls } = machine(3, site.promise);
    const said: string[] = [];
    const served = serveDocs("/docs", PAGE, system, (text) => {
      said.push(text);
    });
    await settle();
    expect(calls).toEqual(["start /docs", "wait", "wait", `open ${PAGE}`]);
    expect(said).toEqual([
      "Starting the docs site: pnpm dev:docs in /docs\n",
      `Opening ${PAGE}. Stop the docs site with Ctrl-C.\n`,
    ]);
    // Ctrl-C stops the site, and with it the preview.
    site.resolve(130);
    expect(await served).toBe(130);
  });

  test("opens nothing when the docs site stops before it listens", async () => {
    const { system, calls } = machine(Infinity, Promise.resolve(1));
    expect(await serveDocs("/docs", PAGE, system, quiet)).toBe(1);
    expect(calls).not.toContain(`open ${PAGE}`);
  });

  test("passes on why the docs site could not start", async () => {
    const failure = new GeneratorError("Cannot start the docs site.");
    const { system, calls } = machine(Infinity, Promise.reject(failure));
    const outcome = await serveDocs("/docs", PAGE, system, quiet).then(
      () => "served",
      (error: unknown) => error,
    );
    expect(outcome).toBe(failure);
    expect(calls).not.toContain(`open ${PAGE}`);
  });
});

describe("localSystem", () => {
  test("knows whether something listens on the host and port of a URL", async () => {
    const server = createServer().listen(0, "127.0.0.1");
    await once(server, "listening");
    const { port } = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${port}/docs`;
    expect(await localSystem.listening(url)).toBe(true);
    server.close();
    await once(server, "close");
    expect(await localSystem.listening(url)).toBe(false);
  });
});
