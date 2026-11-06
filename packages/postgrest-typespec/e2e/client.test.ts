// End-to-end tests: the JavaScript client emitted from the TypeSpec model,
// against a real PostgREST server running `fixture.sql`. Start the server with
// `bun run e2e:up`.

import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import type { PathUncheckedResponse } from "@typespec/ts-http-runtime";
import { PostgRestClient } from "../clients/js/src/index.js";
import { RestError } from "../clients/js/src/helpers/error.js";

const baseUrl = process.env.POSTGREST_URL ?? "http://localhost:3901";
const jwtSecret = "e2e-secret-that-is-at-least-32-characters-long";

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function jwt(claims: Record<string, unknown>): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify(claims));
  const signature = createHmac("sha256", jwtSecret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function clientWithToken(token: string): PostgRestClient {
  return new PostgRestClient(
    { getBearerToken: async () => token },
    { endpoint: baseUrl, allowInsecureConnection: true },
  );
}

const anon = clientWithToken(jwt({ role: "anon" }));
const user = clientWithToken(jwt({ role: "app_user" }));
const db = anon.relationsClient;
const rpc = anon.functionsClient;

/**
 * Records the raw response of one call, for header and status assertions.
 * Spread `options` into the call, then read `response`.
 */
function capture() {
  let seen: PathUncheckedResponse | undefined;
  return {
    options: {
      operationOptions: {
        onResponse: (response: PathUncheckedResponse) => {
          seen = response;
        },
      },
    },
    get response(): PathUncheckedResponse {
      if (!seen) throw new Error("no response captured");
      return seen;
    },
  };
}

/** Sends a request without the client, for requests the client cannot build. */
function raw(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${jwt({ role: "anon" })}`);
  return fetch(baseUrl + path, { ...init, headers });
}

/** Runs a call that must fail, and returns the error. */
async function failure(call: () => Promise<unknown>): Promise<RestError> {
  try {
    await call();
  } catch (error) {
    if (error instanceof RestError) return error;
    throw error;
  }
  throw new Error("expected the call to fail");
}

/** A name that is unique per test run, so write tests can run repeatedly. */
function unique(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

describe("tables and views: read", () => {
  test("returns every row as a JSON array with Content-Range", async () => {
    const c = capture();
    const rows = await db.read("films", { select: "id", order: "id", ...c.options });
    expect(rows).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(+c.response.status).toBe(200);
    expect(c.response.headers["content-range"]).toBe("0-2/*");
  });

  test("applies select aliases, embedding, filters and order", async () => {
    const rows = await db.read("films", {
      select: "title,director:directors(name)",
      filters: { year: "gte.1990" },
      order: "year.desc",
    });
    expect(rows).toEqual([
      { title: "Pulp Fiction", director: { name: "Tarantino" } },
      { title: "Reservoir Dogs", director: { name: "Tarantino" } },
    ]);
  });

  test("supports array, pattern and JSON path filters", async () => {
    const rows = await db.read("films", {
      select: "id",
      filters: { tags: "cs.{crime}", title: "like.*Fiction", "meta->>runtime": "gt.100" },
    });
    expect(rows).toEqual([{ id: 3 }]);
  });

  test("supports the or and not.or logical operators", async () => {
    const either = await db.read("films", { select: "id", or: "(id.eq.1,id.eq.3)", order: "id" });
    expect(either).toEqual([{ id: 1 }, { id: 3 }]);

    const neither = await db.read("films", { select: "id", notOr: "(id.eq.1,id.eq.3)" });
    expect(neither).toEqual([{ id: 2 }]);
  });

  test("filters embedded resources and requires them with !inner", async () => {
    const rows = await db.read("directors", {
      select: "name,films!inner(title)",
      filters: { "films.year": "lt.1900" },
    });
    expect(rows).toEqual([{ name: "Lumière", films: [{ title: "Workers Leaving The Lumière Factory" }] }]);
  });

  test("paginates with limit and offset, and counts with Prefer: count=exact", async () => {
    const c = capture();
    const rows = await db.read("films", {
      select: "id",
      order: "id",
      limit: 1,
      offset: 1,
      prefer: ["count=exact"],
      ...c.options,
    });
    expect(rows).toEqual([{ id: 2 }]);
    expect(+c.response.status).toBe(206);
    expect(c.response.headers["content-range"]).toBe("1-1/3");
    expect(c.response.headers["preference-applied"]).toBe("count=exact");
  });

  test("paginates with the Range header", async () => {
    const c = capture();
    const rows = await db.read("films", { select: "id", order: "id", range: "0-1", ...c.options });
    expect(rows).toEqual([{ id: 1 }, { id: 2 }]);
    expect(c.response.headers["content-range"]).toBe("0-1/*");
  });

  test("rejects an invalid range with 416", async () => {
    const error = await failure(() =>
      db.read("films", { prefer: ["count=exact"], range: "10-20" }),
    );
    expect(+error.status).toBe(416);
    expect(error.body.code).toBe("PGRST103");
  });

  test("returns a single object for vnd.pgrst.object+json", async () => {
    const row = await db.read("films", {
      select: "title",
      filters: { id: "eq.2" },
      accept: "application/vnd.pgrst.object+json",
    });
    expect(row).toEqual({ title: "Reservoir Dogs" });
  });

  test("rejects a singular response with several rows (PGRST116)", async () => {
    const error = await failure(() => db.read("films", { accept: "application/vnd.pgrst.object+json" }));
    expect(+error.status).toBe(406);
    expect(error.body.code).toBe("PGRST116");
  });

  test("returns CSV", async () => {
    const csv = await db.read("films", { select: "id,year", order: "id", accept: "text/csv" });
    expect(csv).toBe("id,year\n1,1895\n2,1992\n3,1994");
  });

  test("strips nulls with nulls=stripped", async () => {
    const plain = await db.read("films", { select: "id,missing:meta->>nothing", filters: { id: "eq.1" } });
    expect(plain).toEqual([{ id: 1, missing: null }]);

    const stripped = await db.read("films", {
      select: "id,missing:meta->>nothing",
      filters: { id: "eq.1" },
      accept: "application/vnd.pgrst.array+json;nulls=stripped",
    });
    expect(stripped).toEqual([{ id: 1 }]);
  });

  test("returns EXPLAIN plans as text and JSON", async () => {
    // The emitted client matches content types by substring, and the plan
    // media type carries `for="application/json"`, so check the raw response.
    const c = capture();
    await db.read("films", { accept: "application/vnd.pgrst.plan+text", ...c.options });
    expect(c.response.headers["content-type"]).toStartWith("application/vnd.pgrst.plan+text");
    expect(String(c.response.body)).toContain("Seq Scan");

    const json = await db.read("films", { accept: "application/vnd.pgrst.plan+json" });
    expect(Array.isArray(json)).toBe(true);
    expect((json as Array<Record<string, unknown>>)[0]).toHaveProperty("Plan");
  });

  test("computes aggregates", async () => {
    const rows = await db.read("films", { select: "director_id,count()", order: "director_id" });
    expect(rows).toEqual([
      { director_id: 1, count: 1 },
      { director_id: 2, count: 2 },
    ]);
  });

  test("reads views", async () => {
    const rows = await db.read("film_titles", { filters: { id: "eq.1" } });
    expect(rows).toEqual([{ id: 1, title: "Workers Leaving The Lumière Factory" }]);
  });

  test("switches schema with Accept-Profile", async () => {
    const rows = await db.read("items", { acceptProfile: "tenant2" });
    expect(rows).toEqual([{ id: 1, name: "tenant2 item" }]);

    const error = await failure(() => db.read("items", { acceptProfile: "nope" }));
    expect(+error.status).toBe(406);
    expect(error.body.code).toBe("PGRST106");
  });

  test("HEAD returns headers only", async () => {
    const c = capture();
    await db.readHead("films", { prefer: ["count=exact"], ...c.options });
    expect([200, 206]).toContain(+c.response.status);
    expect(c.response.headers["content-range"]).toBe("0-2/3");
  });
});

describe("errors", () => {
  test("unknown table is 404 PGRST205 with Proxy-Status", async () => {
    const error = await failure(() => db.read("nope"));
    expect(+error.status).toBe(404);
    expect(error.body.code).toBe("PGRST205");
    expect(error.headers["proxy-status"]).toBe("PostgREST; error=PGRST205");
  });

  test("malformed filter is 400 PGRST100", async () => {
    const error = await failure(() => db.read("films", { filters: { id: "nope.1" } }));
    expect(+error.status).toBe(400);
    expect(error.body.code).toBe("PGRST100");
  });

  test("insufficient privilege is 401 for the anonymous role, 403 for others", async () => {
    const anonymous = await failure(() => db.read("secrets"));
    expect(+anonymous.status).toBe(401);
    expect(anonymous.body.code).toBe("42501");

    const authenticated = await failure(() => user.relationsClient.read("audit"));
    expect(+authenticated.status).toBe(403);
    expect(authenticated.body.code).toBe("42501");

    const rows = await user.relationsClient.read("secrets");
    expect(rows).toEqual([{ id: 1, value: "hidden" }]);
  });

  test("an invalid JWT is 401 PGRST301", async () => {
    const error = await failure(() => clientWithToken("not-a-jwt").relationsClient.read("films"));
    expect(+error.status).toBe(401);
    expect(error.body.code).toBe("PGRST301");
  });

  test("strict handling rejects invalid preferences (PGRST122)", async () => {
    const error = await failure(() =>
      db.read("films", { prefer: ["handling=strict", "count=bogus" as never] }),
    );
    expect(+error.status).toBe(400);
    expect(error.body.code).toBe("PGRST122");
  });
});

describe("tables and views: write", () => {
  test("insert returns 201 without a body by default", async () => {
    const c = capture();
    const result = await db.insert("items", { name: unique("minimal") }, c.options);
    expect(result).toBeUndefined();
    expect(+c.response.status).toBe(201);
  });

  test("insert with return=representation returns the rows", async () => {
    const name = unique("rep");
    const rows = await db.insert("items", { name }, { select: "name,qty", prefer: ["return=representation"] });
    expect(rows).toEqual([{ name, qty: 10 }]);
  });

  test("insert with return=headers-only sets Location", async () => {
    const c = capture();
    await db.insert("items", { name: unique("loc") }, { prefer: ["return=headers-only"], ...c.options });
    expect(c.response.headers["location"]).toMatch(/^\/items\?id=eq\.\d+$/);
  });

  test("bulk insert with columns and missing=default", async () => {
    const [a, b] = [unique("bulk"), unique("bulk")];
    const rows = await db.insert("items", [{ name: a }, { name: b, qty: 3 }], {
      columns: "name,qty",
      select: "name,qty",
      prefer: ["return=representation", "missing=default"],
    });
    expect(rows).toEqual([
      { name: a, qty: 10 },
      { name: b, qty: 3 },
    ]);
  });

  test("upsert with on_conflict and merge-duplicates is 200 when it only updates", async () => {
    const name = unique("upsert");
    await db.insert("items", { name, qty: 1 });
    const c = capture();
    const rows = await db.insert("items", { name, qty: 2 }, {
      onConflict: "name",
      select: "name,qty",
      prefer: ["resolution=merge-duplicates", "return=representation"],
      ...c.options,
    });
    expect(rows).toEqual([{ name, qty: 2 }]);
    expect(+c.response.status).toBe(200);
  });

  test("uniqueness violation is 409", async () => {
    const name = unique("dup");
    await db.insert("items", { name });
    const error = await failure(() => db.insert("items", { name }));
    expect(+error.status).toBe(409);
    expect(error.body.code).toBe("23505");
  });

  test("insert from CSV", async () => {
    const name = unique("csv");
    const rows = await db.insertCsv("items", `name,qty\n${name},7`, {
      select: "name,qty",
      prefer: ["return=representation"],
    });
    expect(rows).toEqual([{ name, qty: 7 }]);
  });

  test("insert from a URL-encoded form", async () => {
    // The emitted client sends `insertForm` bodies as JSON, so send the form
    // by hand to check the modeled request.
    const name = unique("form");
    const response = await raw("/items?select=name,qty", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Prefer: "return=representation" },
      body: new URLSearchParams({ name, qty: "5" }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual([{ name, qty: 5 }]);
  });

  test("insert into another schema with Content-Profile", async () => {
    const id = Math.floor(Math.random() * 1e9) + 10;
    const rows = await db
      .insert("items", { id, name: "t2" }, { contentProfile: "tenant2", prefer: ["return=representation"] })
      .catch((error: RestError) => error);
    // anon has only SELECT on tenant2.items.
    expect(rows).toBeInstanceOf(RestError);
    expect((rows as RestError).body.code).toBe("42501");
  });

  test("update with filters, count and representation", async () => {
    const name = unique("upd");
    await db.insert("items", { name });
    const c = capture();
    const rows = await db.update("items", { qty: 99 }, {
      filters: { name: `eq.${name}` },
      select: "name,qty",
      prefer: ["return=representation", "count=exact"],
      ...c.options,
    });
    expect(rows).toEqual([{ name, qty: 99 }]);
    expect(+c.response.status).toBe(200);
    expect(c.response.headers["content-range"]).toBe("0-0/1");
  });

  test("update without representation is 204", async () => {
    const name = unique("upd204");
    await db.insert("items", { name });
    const c = capture();
    const result = await db.update("items", { qty: 1 }, { filters: { name: `eq.${name}` }, ...c.options });
    expect(result).toBeUndefined();
    expect(+c.response.status).toBe(204);
  });

  test("PUT upserts a single row by primary key", async () => {
    const id = 1_000_000 + Math.floor(Math.random() * 1e6);
    const name = unique("put");
    const options = { filters: { id: `eq.${id}` }, prefer: ["return=representation" as const] };

    const inserted = capture();
    const created = await db.upsert("items", { id, name, qty: 4 }, { ...options, ...inserted.options });
    expect(created).toEqual([{ id, name, qty: 4 }]);
    expect(+inserted.response.status).toBe(201);

    const updated = capture();
    const replaced = await db.upsert("items", { id, name, qty: 5 }, { ...options, ...updated.options });
    expect(replaced).toEqual([{ id, name, qty: 5 }]);
    expect(+updated.response.status).toBe(200);
  });

  test("delete with representation", async () => {
    const name = unique("del");
    await db.insert("items", { name });
    const rows = await db.delete_("items", {
      filters: { name: `eq.${name}` },
      select: "name",
      prefer: ["return=representation"],
    });
    expect(rows).toEqual([{ name }]);
  });

  test("max-affected with strict handling rejects large deletes (PGRST124)", async () => {
    const prefix = unique("max");
    await db.insert("items", [{ name: `${prefix}-a` }, { name: `${prefix}-b` }]);
    const error = await failure(() =>
      db.delete_("items", {
        filters: { name: `like.${prefix}*` },
        prefer: ["handling=strict", "max-affected=1"],
      }),
    );
    expect(+error.status).toBe(400);
    expect(error.body.code).toBe("PGRST124");
  });

  test("tx=rollback discards the write", async () => {
    const name = unique("rollback");
    const rows = await db.insert("items", { name }, {
      select: "name",
      prefer: ["tx=rollback", "return=representation"],
    });
    expect(rows).toEqual([{ name }]);
    expect(await db.read("items", { filters: { name: `eq.${name}` } })).toEqual([]);
  });
});

describe("functions", () => {
  test("GET passes arguments as query parameters", async () => {
    expect(await rpc.call("add", { arguments: { a: "1", b: "2" } })).toBe(3);
  });

  test("POST passes arguments as a JSON object", async () => {
    expect(await rpc.invoke("add", { a: 20, b: 22 })).toBe(42);
  });

  test("table-valued functions accept select, filters and order", async () => {
    const rows = await rpc.call("films_since", {
      arguments: { since: "1990", title: "like.*Dogs" },
      select: "title,directors(name)",
      order: "title",
    });
    expect(rows).toEqual([{ title: "Reservoir Dogs", directors: { name: "Tarantino" } }]);
  });

  test("void functions return 204", async () => {
    const c = capture();
    const result = await rpc.invoke("touch_items", {}, c.options);
    expect(result).toBeUndefined();
    expect(+c.response.status).toBe(204);
  });

  test("GET runs read-only, so a writing volatile function fails with 405", async () => {
    const error = await failure(() => rpc.call("touch_items"));
    expect(+error.status).toBe(405);
    expect(error.body.code).toBe("25006");
  });

  test("GET repeats a key for a variadic argument", async () => {
    // A Record<string> cannot repeat a key, so build the query string by hand.
    const response = await raw("/rpc/sum_all?v=1&v=2&v=3");
    expect(response.status).toBe(200);
    expect(await response.json()).toBe(6);
  });

  test("a single unnamed json parameter receives the whole body", async () => {
    expect(await rpc.invoke("echo_json", { one: 1, two: [2] })).toEqual({ one: 1, two: [2] });
  });

  test("variadic arguments take a JSON array", async () => {
    expect(await rpc.invoke("sum_all", { v: [1, 2, 3] })).toBe(6);
  });

  test("raw text, XML and binary bodies", async () => {
    expect(await rpc.invokeText("echo_text", "hello")).toBe("hello");
    expect(await rpc.invokeXml("echo_xml", "<a>1</a>")).toBe("<a>1</a>");
    expect(await rpc.invokeBinary("byte_length", new Uint8Array([1, 2, 3, 4]))).toBe(4);
  });

  test("URL-encoded arguments", async () => {
    // The emitted client sends `invokeForm` bodies as JSON; see the insert test.
    const response = await raw("/rpc/add", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "a=2&b=3",
    });
    expect(await response.json()).toBe(5);
  });

  test("unknown function is 404 PGRST202", async () => {
    const error = await failure(() => rpc.invoke("nope", {}));
    expect(+error.status).toBe(404);
    expect(error.body.code).toBe("PGRST202");
  });

  test("RAISE with SQLSTATE PTxyz sets the status", async () => {
    const error = await failure(() => rpc.invoke("pay", {}));
    expect(+error.status).toBe(402);
    expect(error.body).toMatchObject({ code: "PT402", message: "Payment Required", details: "Quota exceeded" });
  });

  test("HEAD calls a stable function without a body", async () => {
    const c = capture();
    await rpc.callHead("films_since", { arguments: { since: "1990" }, ...c.options });
    expect(+c.response.status).toBe(200);
  });
});

describe("root", () => {
  test("describes the schema as OpenAPI 2.0", async () => {
    const document = await anon.rootClient.describe();
    expect(document).toMatchObject({ swagger: "2.0" });
    expect(Object.keys((document as { paths: object }).paths)).toContain("/films");
  });

  test("HEAD on the root path", async () => {
    const c = capture();
    await anon.rootClient.describeHead(c.options);
    expect(+c.response.status).toBe(200);
  });
});
