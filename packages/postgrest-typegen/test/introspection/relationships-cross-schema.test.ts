import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { Pool } from "pg";
import { Wait } from "testcontainers";

import { introspect } from "../../src/introspection/index.ts";
import type { PostgresRelationship } from "../../src/types.ts";

let container: StartedPostgreSqlContainer;
let pool: Pool;
let relationships: PostgresRelationship[];

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:15-alpine")
    .withUsername("postgres")
    .withPassword("postgres")
    .withDatabase("postgres")
    .withWaitStrategy(Wait.forHealthCheck())
    .withStartupTimeout(120_000)
    .start();
  pool = new Pool({ connectionString: container.getConnectionUri() });
  await pool.query(/* SQL */ `
    create schema private;
    create table public.organizations (id int primary key);
    create table private.projects (
      id int primary key,
      organization_id int not null
        constraint projects_organization_id_fkey references public.organizations (id)
    );
    create table private.members (
      id int primary key,
      project_id int not null
        constraint members_project_id_fkey references private.projects (id)
    );
    create view public.projects as select * from private.projects;
    create view public.members as select * from private.members;
  `);
  ({ relationships } = await introspect(pool, {
    includedSchemas: ["public"],
  }));
}, 180_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

const named = (foreignKeyName: string) =>
  relationships.filter((r) => r.foreign_key_name === foreignKeyName);

describe("view relationships over tables in a schema that is not requested", () => {
  test("a view over a private table keeps the foreign key to a public table", () => {
    expect(named("projects_organization_id_fkey")).toEqual([
      {
        foreign_key_name: "projects_organization_id_fkey",
        schema: "public",
        relation: "projects",
        columns: ["organization_id"],
        is_one_to_one: false,
        referenced_schema: "public",
        referenced_relation: "organizations",
        referenced_columns: ["id"],
      },
    ]);
  });

  test("views over private tables relate to each other through a private foreign key", () => {
    const viewToView = named("members_project_id_fkey").find(
      (r) => r.referenced_schema === "public",
    );
    expect(viewToView).toEqual({
      foreign_key_name: "members_project_id_fkey",
      schema: "public",
      relation: "members",
      columns: ["project_id"],
      is_one_to_one: false,
      referenced_schema: "public",
      referenced_relation: "projects",
      referenced_columns: ["id"],
    });
  });

  test("relationships of the private tables are not emitted", () => {
    expect(relationships.filter((r) => r.schema !== "public")).toEqual([]);
  });
});
