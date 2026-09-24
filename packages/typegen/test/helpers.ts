import type { Host, SpawnRequest, SpawnResult } from "../src/index.ts";

export interface FakeHost extends Host {
  readonly requests: SpawnRequest[];
}

/**
 * Records every spawn request and answers with `respond`, which may also
 * throw to simulate a missing executable.
 */
export function createFakeHost(
  respond: (request: SpawnRequest) => SpawnResult | Promise<SpawnResult> = () =>
    fail("the fake host was not expected to spawn anything"),
  overrides: Partial<Omit<Host, "spawn">> = {},
): FakeHost {
  const requests: SpawnRequest[] = [];
  return {
    cwd: "/projects/app",
    env: { PATH: "/usr/bin", HOME: "/home/dev" },
    ...overrides,
    requests,
    async spawn(request) {
      requests.push(request);
      return await respond(request);
    },
  };
}

export const commandNotFound = (command: string): Error =>
  Object.assign(new Error(`spawn ${command} ENOENT`), {
    code: "ENOENT",
    syscall: `spawn ${command}`,
    path: command,
  });

const fail = (message: string): never => {
  throw new Error(message);
};

/** Resolves to the rejection reason of `promise`, or `undefined` if it fulfilled. */
export const rejection = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => undefined,
    (caught: unknown) => caught,
  );
