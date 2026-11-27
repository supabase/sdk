import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readBundledSchema } from "../src/index.ts";

/** Where the schema file is in the test repository. */
export const SCHEMA_PATH = "docs/reference/definition.schema.json";

/**
 * The bundled schema with `category` made required. A definition without a
 * category passes the bundled schema and fails this one, which shows which of
 * the two a check ran against.
 */
export const stricterSchema = (): string => {
  const schema = JSON.parse(readBundledSchema()) as { required: string[] };
  return JSON.stringify({
    ...schema,
    required: [...schema.required, "category"],
  });
};

export interface SchemaServer {
  /** The URL of a path on the server. */
  readonly url: (path: string) => string;
  readonly stop: () => Promise<void>;
}

/** A real HTTP server on a free local port, serving schema files. */
export function serveSchemas(): SchemaServer {
  const json = (body: string): Response =>
    new Response(body, { headers: { "content-type": "application/json" } });
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      switch (new URL(request.url).pathname) {
        case "/schema.json":
          return json(readBundledSchema());
        case "/stricter.json":
          return json(stricterSchema());
        case "/moved.json":
          return Response.redirect("/schema.json", 302);
        case "/page.html":
          return new Response("<html>Not found</html>");
        case "/not-a-schema.json":
          return json('{ "type": "nope" }');
        default:
          return new Response("Not found", { status: 404 });
      }
    },
  });
  return {
    url: (path) => `http://localhost:${server.port}${path}`,
    stop: () => server.stop(true),
  };
}

export interface SchemaRepository {
  readonly directory: string;
  /** The commit that added the bundled schema. No branch points at it. */
  readonly firstCommit: string;
  /** The tip of `main`, which still has the bundled schema. */
  readonly mainCommit: string;
  readonly remove: () => void;
}

/**
 * A real Git repository in a temporary folder:
 *
 * - `main` has the bundled schema, added in its first commit and tagged `v1`
 * - `stricter` has the stricter schema
 */
export function createSchemaRepository(): SchemaRepository {
  const directory = mkdtempSync(join(tmpdir(), "doc-check-repository-"));
  const git = (...args: string[]): string =>
    execFileSync("git", args, {
      cwd: directory,
      encoding: "utf8",
      // Not the configuration of whoever runs the tests: no signing, no hooks.
      env: {
        PATH: process.env.PATH,
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_AUTHOR_NAME: "Test",
        GIT_AUTHOR_EMAIL: "test@example.com",
        GIT_COMMITTER_NAME: "Test",
        GIT_COMMITTER_EMAIL: "test@example.com",
      },
    }).trim();
  const commit = (file: string, content: string): string => {
    mkdirSync(join(directory, file, ".."), { recursive: true });
    writeFileSync(join(directory, file), content);
    git("add", file);
    git("commit", "--quiet", "--message", `Change ${file}`);
    return git("rev-parse", "HEAD");
  };

  git("init", "--quiet", "--initial-branch", "main");
  const firstCommit = commit(SCHEMA_PATH, readBundledSchema());
  git("tag", "v1");
  const mainCommit = commit("README.md", "# Docs\n");
  git("switch", "--quiet", "--create", "stricter");
  commit(SCHEMA_PATH, stricterSchema());
  git("switch", "--quiet", "main");

  return {
    directory,
    firstCommit,
    mainCommit,
    remove: () => rmSync(directory, { recursive: true, force: true }),
  };
}
