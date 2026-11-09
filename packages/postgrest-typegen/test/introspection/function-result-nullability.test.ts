import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { Pool } from "pg";
import { Wait } from "testcontainers";

import { introspect } from "../../src/introspection/index.ts";
import type { GeneratorMetadata } from "../../src/types.ts";

/**
 * Integration coverage for `RETURNS TABLE` column nullability, on the same
 * PostgreSQL versions as view column nullability, whose inference it reuses.
 */
const SCHEMA = /* SQL */ `
  create schema private;
  create table private.authors (id int primary key, name text not null, bio text);
  create table public.books (
    id int primary key,
    author_id int references private.authors,
    title text not null
  );
  create view private.author_names as select id, name from private.authors;

  create function public.atomic_plain()
  returns table (id int, title text, shouted text, author_id int)
  language sql stable
  begin atomic
    select id, title, upper(title), author_id from public.books;
  end;

  create function public.atomic_left_joined()
  returns table (title text, name text)
  language sql stable
  begin atomic
    select 1;
    select b.title, a.name from public.books b left join private.authors a on a.id = b.author_id;
  end;

  create function public.atomic_from_view()
  returns table (id int, name text)
  language sql stable
  begin atomic
    select id, name from private.author_names;
  end;

  create function public.atomic_returning()
  returns table (name text, bio text)
  begin atomic
    update private.authors set name = name where false returning name, bio;
  end;

  create function public.string_body()
  returns table (id int, title text)
  language sql stable
  as $$ select id, title from public.books $$;

  create function public.plpgsql_named()
  returns table (id int, title text, author_id int)
  language plpgsql stable
  as $$ begin return query select b.id, b.title, b.author_id from public.books b; end $$;
  comment on function public.plpgsql_named() is E'Books.\n@notNull id, title';

  create function public.plpgsql_all()
  returns table (id int, title text)
  language plpgsql stable
  as $$ begin return query select b.id, b.title from public.books b; end $$;
  comment on function public.plpgsql_all() is '@notNull';

  create function public.scalar(value int) returns int language sql return value;
`;

const resultNullability = (metadata: GeneratorMetadata, name: string) =>
  Object.fromEntries(
    (
      metadata.rpcFunctions?.find((fn) => fn.name === name)?.overloads[0]
        ?.returns.columns ?? []
    ).map((column) => [column.name, column.is_nullable]),
  );

describe.each(["15", "17", "18"])(
  "RETURNS TABLE column nullability (PostgreSQL %s)",
  (version) => {
    let container: StartedPostgreSqlContainer;
    let pool: Pool;
    let metadata: GeneratorMetadata;

    beforeAll(async () => {
      container = await new PostgreSqlContainer(`postgres:${version}-alpine`)
        .withWaitStrategy(Wait.forHealthCheck())
        .withStartupTimeout(120_000)
        .start();
      pool = new Pool({ connectionString: container.getConnectionUri() });
      await pool.query(SCHEMA);
      metadata = await introspect(pool, { includedSchemas: ["public"] });
    }, 180_000);

    afterAll(async () => {
      await pool?.end();
      await container?.stop();
    });

    test("a BEGIN ATOMIC body proves plain references to NOT NULL columns", () => {
      expect(resultNullability(metadata, "atomic_plain")).toEqual({
        author_id: true,
        id: false,
        shouted: true,
        title: false,
      });
    });

    test("the last statement decides, and outer joins stay nullable", () => {
      expect(resultNullability(metadata, "atomic_left_joined")).toEqual({
        name: true,
        title: false,
      });
    });

    test("views read by the body are followed to their source", () => {
      expect(resultNullability(metadata, "atomic_from_view")).toEqual({
        id: false,
        name: false,
      });
    });

    test("a RETURNING clause proves nothing", () => {
      expect(resultNullability(metadata, "atomic_returning")).toEqual({
        bio: true,
        name: true,
      });
    });

    test("a string body proves nothing", () => {
      expect(resultNullability(metadata, "string_body")).toEqual({
        id: true,
        title: true,
      });
    });

    test("an @notNull line in the function comment names non-null columns", () => {
      expect(resultNullability(metadata, "plpgsql_named")).toEqual({
        author_id: true,
        id: false,
        title: false,
      });
      expect(resultNullability(metadata, "plpgsql_all")).toEqual({
        id: false,
        title: false,
      });
    });

    test("only the table arguments carry is_nullable", () => {
      const args = (name: string) =>
        metadata.functions.find((fn) => fn.name === name)?.args ?? [];
      expect(args("scalar").map((arg) => arg.is_nullable)).toEqual([undefined]);
      expect(
        Object.fromEntries(
          args("atomic_plain").map((arg) => [arg.name, arg.is_nullable]),
        ),
      ).toEqual({ author_id: true, id: false, shouted: true, title: false });
    });
  },
);
