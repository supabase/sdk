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
 * Integration coverage for view column nullability. PostgreSQL 15 has no
 * `varnullingrels`, PostgreSQL 18 routes grouped columns through a group range
 * table entry, and PostgreSQL 17 is what Supabase projects run, so each of them
 * must resolve the same columns as non-null.
 */
const SCHEMA = /* SQL */ `
  create schema private;
  create domain non_empty_text as text not null;
  create table private.authors (
    id int primary key,
    name text not null,
    bio text,
    handle non_empty_text
  );
  create table public.books (
    id int primary key,
    author_id int not null references private.authors,
    title text not null
  );
  create view private.author_names as select id, name, bio from private.authors;

  create view public.plain as
    select id, name, bio, handle, upper(name) as shouted, 1 as constant from private.authors;
  create view public.left_joined as
    select a.id, a.name, b.title, b.id as book_id
    from private.authors a left join public.books b on b.author_id = a.id;
  create view public.right_joined as
    select a.name, b.title from private.authors a right join public.books b on b.author_id = a.id;
  create view public.full_joined as
    select a.name, b.title from private.authors a full join public.books b on b.author_id = a.id;
  create view public.using_joined as
    select id, b.title from private.authors a left join public.books b using (id);
  create view public.nested_join as
    select a.name, b.title, c.id as other_id
    from private.authors a
    left join (public.books b join private.authors c on c.id = b.author_id) on b.author_id = a.id;
  create view public.grouped as
    select name, count(*) as books from private.authors group by name;
  create view public.grouping_sets as
    select name, bio, count(*) as books from private.authors group by rollup (name, bio);
  create view public.unioned as
    select name from private.authors union all select title from public.books;
  create view public.from_subquery as
    select s.name, s.title, s.id
    from (select a.name, b.title, a.id from private.authors a left join public.books b on b.author_id = a.id) s;
  create view public.from_cte as
    with named as (select id, name, bio from private.authors) select id, name, bio from named;
  create view public.from_view as select id, name, bio from private.author_names;
  create view public.coalesced as select coalesce(bio, '') as bio from private.authors;
  comment on column public.coalesced.bio is E'Never null.\n@notNull';
  create materialized view public.materialized as select id, bio from private.authors;
`;

const nullability = (metadata: GeneratorMetadata, view: string) =>
  Object.fromEntries(
    metadata.columns
      .filter((column) => column.schema === "public" && column.table === view)
      .map((column) => [column.name, column.is_nullable]),
  );

describe.each(["15", "17", "18"])(
  "view column nullability (PostgreSQL %s)",
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

    test("plain references follow the source column, expressions stay nullable", () => {
      expect(nullability(metadata, "plain")).toEqual({
        id: false,
        name: false,
        bio: true,
        handle: false,
        shouted: true,
        constant: true,
      });
    });

    test("columns on the nullable side of an outer join stay nullable", () => {
      expect(nullability(metadata, "left_joined")).toEqual({
        id: false,
        name: false,
        title: true,
        book_id: true,
      });
      expect(nullability(metadata, "right_joined")).toEqual({
        name: true,
        title: false,
      });
      expect(nullability(metadata, "full_joined")).toEqual({
        name: true,
        title: true,
      });
      expect(nullability(metadata, "using_joined")).toEqual({
        id: false,
        title: true,
      });
      expect(nullability(metadata, "nested_join")).toEqual({
        name: false,
        title: true,
        other_id: true,
      });
    });

    test("grouping keeps plain group keys, grouping sets and set operations do not", () => {
      expect(nullability(metadata, "grouped")).toEqual({
        name: false,
        books: true,
      });
      expect(nullability(metadata, "grouping_sets")).toEqual({
        name: true,
        bio: true,
        books: true,
      });
      expect(nullability(metadata, "unioned")).toEqual({ name: true });
    });

    test("subqueries, CTEs and views are followed to their source", () => {
      expect(nullability(metadata, "from_subquery")).toEqual({
        name: false,
        title: true,
        id: false,
      });
      expect(nullability(metadata, "from_cte")).toEqual({
        id: false,
        name: false,
        bio: true,
      });
      expect(nullability(metadata, "from_view")).toEqual({
        id: false,
        name: false,
        bio: true,
      });
      expect(nullability(metadata, "materialized")).toEqual({
        id: false,
        bio: true,
      });
    });

    test("an @notNull line in the column comment marks the column non-null", () => {
      expect(nullability(metadata, "coalesced")).toEqual({ bio: false });
    });

    test("table columns are left alone", () => {
      expect(nullability(metadata, "books")).toEqual({
        id: false,
        author_id: false,
        title: false,
      });
    });
  },
);
