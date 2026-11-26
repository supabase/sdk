import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { Pool } from "pg";
import { Wait } from "testcontainers";

import { generateTypescript } from "../../src/generation/typescript.ts";
import { introspect } from "../../src/introspection/index.ts";
import type {
  GeneratorMetadata,
  PostgresRelationship,
} from "../../src/types.ts";

let container: StartedPostgreSqlContainer;
let pool: Pool;
let metadata: GeneratorMetadata;

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

    create schema api;
    create schema extra;
    create table api.accounts (id int primary key);
    create table private.invoices (
      id int primary key,
      account_id int not null
        constraint invoices_account_id_fkey references api.accounts (id)
    );
    create view extra.invoices as select * from private.invoices;
    create view api.invoices as select * from extra.invoices;
    create table api.payments (
      id int primary key,
      invoice_id int not null
        constraint payments_invoice_id_fkey references private.invoices (id)
    );
  `);
  metadata = await introspect(pool, { includedSchemas: ["public"] });
}, 180_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

const named = (foreignKeyName: string) =>
  metadata.relationships.filter((r) => r.foreign_key_name === foreignKeyName);

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
    expect(named("members_project_id_fkey")).toEqual([
      {
        foreign_key_name: "members_project_id_fkey",
        schema: "public",
        relation: "members",
        columns: ["project_id"],
        is_one_to_one: false,
        referenced_schema: "private",
        referenced_relation: "projects",
        referenced_columns: ["id"],
      },
      {
        foreign_key_name: "members_project_id_fkey",
        schema: "public",
        relation: "members",
        columns: ["project_id"],
        is_one_to_one: false,
        referenced_schema: "public",
        referenced_relation: "projects",
        referenced_columns: ["id"],
      },
    ]);
  });

  test("relationships of the private tables are not emitted", () => {
    expect(metadata.relationships.filter((r) => r.schema !== "public")).toEqual(
      [],
    );
  });

  test("the generated view types reference the public relations only", async () => {
    const output = await generateTypescript(metadata);
    const views = output.slice(
      output.indexOf("Views: {"),
      output.indexOf("Functions: {"),
    );
    expect(views).toMatchInlineSnapshot(`
      "Views: {
            members: {
              Row: {
                id: number
                project_id: number
              }
              ComputedFields: never
              Insert: {
                id?: number | null
                project_id?: number | null
              }
              Update: {
                id?: number | null
                project_id?: number | null
              }
              Relationships: [
                {
                  foreignKeyName: "members_project_id_fkey"
                  columns: ["project_id"]
                  referencedRelation: "projects"
                  referencedColumns: ["id"]
                },
              ]
            }
            projects: {
              Row: {
                id: number
                organization_id: number
              }
              ComputedFields: never
              Insert: {
                id?: number | null
                organization_id?: number | null
              }
              Update: {
                id?: number | null
                organization_id?: number | null
              }
              Relationships: [
                {
                  foreignKeyName: "projects_organization_id_fkey"
                  columns: ["organization_id"]
                  referencedRelation: "organizations"
                  referencedColumns: ["id"]
                },
              ]
            }
          }
          "
    `);
  });
});

describe("view relationships through a view in an extra search path schema", () => {
  const apiRelationships = async (
    foreignKeyName: string,
    extraSearchPath?: string[],
  ) =>
    (
      await introspect(pool, { includedSchemas: ["api"], extraSearchPath })
    ).relationships.filter((r) => r.foreign_key_name === foreignKeyName);

  const paymentsToPrivateInvoices: PostgresRelationship = {
    foreign_key_name: "payments_invoice_id_fkey",
    schema: "api",
    relation: "payments",
    columns: ["invoice_id"],
    is_one_to_one: false,
    referenced_schema: "private",
    referenced_relation: "invoices",
    referenced_columns: ["id"],
  };

  test("a view gets its base table's foreign key when the schema is passed", async () => {
    expect(
      await apiRelationships("invoices_account_id_fkey", ["extra"]),
    ).toEqual([
      {
        foreign_key_name: "invoices_account_id_fkey",
        schema: "api",
        relation: "invoices",
        columns: ["account_id"],
        is_one_to_one: false,
        referenced_schema: "api",
        referenced_relation: "accounts",
        referenced_columns: ["id"],
      },
    ]);
  });

  test("a foreign key to the base table reaches the view when the schema is passed", async () => {
    expect(
      await apiRelationships("payments_invoice_id_fkey", ["extra"]),
    ).toEqual([
      paymentsToPrivateInvoices,
      {
        ...paymentsToPrivateInvoices,
        referenced_schema: "api",
      },
    ]);
  });

  test("both stay unresolved without it", async () => {
    expect(await apiRelationships("invoices_account_id_fkey")).toEqual([]);
    expect(await apiRelationships("payments_invoice_id_fkey")).toEqual([
      paymentsToPrivateInvoices,
    ]);
  });
});
