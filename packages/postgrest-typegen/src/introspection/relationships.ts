import type { PostgresRelationship } from "../types.ts";
import type { Queryable } from "./index.ts";
import { DEFAULT_SYSTEM_SCHEMAS, filterByList } from "./sql/helpers.ts";
import { TABLE_RELATIONSHIPS_SQL } from "./sql/table_relationships.sql.ts";
import { VIEWS_KEY_DEPENDENCIES_SQL } from "./sql/views_key_dependencies.sql.ts";

/**
 * Port of `postgres-meta/src/lib/PostgresMetaRelationships.ts`.
 *
 * The relationships used for type generation come in two parts:
 *  1. table↔table m2o/o2o relationships, read directly from `pg_constraint`
 *     (`TABLE_RELATIONSHIPS_SQL`); and
 *  2. relationships that involve a view on either side, which PostgREST derives
 *     by mapping a base table's foreign key columns onto the view columns that
 *     select them (`VIEWS_KEY_DEPENDENCIES_SQL` + the cartesian-product
 *     expansion below). This second part is pure TypeScript, not SQL — ported
 *     from postgres-meta, except that the expansion sees every non-system
 *     schema's foreign keys, as PostgREST does (see `listRelationships`).
 *
 * Adapted from:
 * https://github.com/PostgREST/postgrest/blob/f9f0f79fa914ac00c11fbf7f4c558e14821e67e2/src/PostgREST/SchemaCache.hs#L392
 */

type ColDep = {
  table_column: string;
  view_columns: string[];
};

export type ViewKeyDependency = {
  table_schema: string;
  table_name: string;
  view_schema: string;
  view_name: string;
  constraint_name: string;
  constraint_type: "f" | "f_ref" | "p" | "p_ref";
  column_dependencies: ColDep[];
};

/**
 * Expand the table↔table relationships into the view↔table / table↔view /
 * view↔view relationships implied by the view key dependencies. Pure function
 * (no database) so the cartesian-product expansion can be unit-tested directly.
 *
 * Ported from `PostgresMetaRelationships.list()` (the body of the
 * `allViewM2oAndO2oRelationships` block). Every table relationship feeds the
 * expansion, but a table→view relationship is emitted on the table itself, so
 * `isTableEmitted` keeps it to the tables the caller returns relationships for.
 */
export function expandViewRelationships(
  allTableM2oAndO2oRelationships: PostgresRelationship[],
  viewsKeyDependencies: ViewKeyDependency[],
  isTableEmitted: (relationship: PostgresRelationship) => boolean,
): PostgresRelationship[] {
  const keyDepsByConstraint = new Map<string, ViewKeyDependency[]>();
  for (const vkd of viewsKeyDependencies) {
    const key = keyDependencyKey(
      vkd.table_schema,
      vkd.table_name,
      vkd.constraint_name,
      vkd.constraint_type,
    );
    let bucket = keyDepsByConstraint.get(key);
    if (!bucket) {
      bucket = [];
      keyDepsByConstraint.set(key, bucket);
    }
    bucket.push(vkd);
  }

  return allTableM2oAndO2oRelationships.flatMap((r) => {
    const expandKeyDepCols = (
      colDeps: ColDep[],
    ): { tableColumns: string[]; viewColumns: string[] }[] => {
      const tableColumns = colDeps.map(({ table_column }) => table_column);
      const cartesianProduct = <T>(lists: T[][]): T[][] =>
        lists.reduce<T[][]>(
          (combinations, entries) =>
            combinations.flatMap((combination) =>
              entries.map((entry) => [...combination, entry]),
            ),
          [[]],
        );
      const viewColumnsPermutations = cartesianProduct(
        colDeps.map((cd) => cd.view_columns),
      );
      return viewColumnsPermutations.map((viewColumns) => ({
        tableColumns,
        viewColumns,
      }));
    };

    const viewToTableKeyDeps =
      keyDepsByConstraint.get(
        keyDependencyKey(r.schema, r.relation, r.foreign_key_name, "f"),
      ) ?? [];
    const tableToViewKeyDeps =
      keyDepsByConstraint.get(
        keyDependencyKey(
          r.referenced_schema,
          r.referenced_relation,
          r.foreign_key_name,
          "f_ref",
        ),
      ) ?? [];

    const viewToTableRelationships = viewToTableKeyDeps.flatMap((vtkd) =>
      expandKeyDepCols(vtkd.column_dependencies).map(({ viewColumns }) => ({
        foreign_key_name: r.foreign_key_name,
        schema: vtkd.view_schema,
        relation: vtkd.view_name,
        columns: viewColumns,
        is_one_to_one: r.is_one_to_one,
        referenced_schema: r.referenced_schema,
        referenced_relation: r.referenced_relation,
        referenced_columns: r.referenced_columns,
      })),
    );

    const tableToViewRelationships = (
      isTableEmitted(r) ? tableToViewKeyDeps : []
    ).flatMap((tvkd) =>
      expandKeyDepCols(tvkd.column_dependencies).map(({ viewColumns }) => ({
        foreign_key_name: r.foreign_key_name,
        schema: r.schema,
        relation: r.relation,
        columns: r.columns,
        is_one_to_one: r.is_one_to_one,
        referenced_schema: tvkd.view_schema,
        referenced_relation: tvkd.view_name,
        referenced_columns: viewColumns,
      })),
    );

    const viewToViewRelationships = viewToTableKeyDeps.flatMap((vtkd) =>
      expandKeyDepCols(vtkd.column_dependencies).flatMap(({ viewColumns }) =>
        tableToViewKeyDeps.flatMap((tvkd) =>
          expandKeyDepCols(tvkd.column_dependencies).map(
            ({ viewColumns: referencedViewColumns }) => ({
              foreign_key_name: r.foreign_key_name,
              schema: vtkd.view_schema,
              relation: vtkd.view_name,
              columns: viewColumns,
              is_one_to_one: r.is_one_to_one,
              referenced_schema: tvkd.view_schema,
              referenced_relation: tvkd.view_name,
              referenced_columns: referencedViewColumns,
            }),
          ),
        ),
      ),
    );

    return [
      ...viewToTableRelationships,
      ...tableToViewRelationships,
      ...viewToViewRelationships,
    ];
  });
}

/**
 * List all relationships (table↔table plus the view-derived ones) for the
 * schemas selected by `schemaFilter`, the `IN (…)`/`NOT IN (…)` fragment
 * `introspect()` builds with the system schemas excluded. Like PostgREST, view
 * expansion sees the foreign keys of every non-system schema, so a view over a
 * table in a schema that is not selected keeps the table's foreign keys; only
 * the views and tables in the selected schemas get relationships. Errors from
 * the injected `Queryable` propagate by throwing — callers adapt.
 */
export async function listRelationships(
  db: Queryable,
  schemaFilter: string,
): Promise<PostgresRelationship[]> {
  const tableRelationshipsQuery = db.query(
    TABLE_RELATIONSHIPS_SQL({ schemaFilter }),
  );
  const [
    { rows: tableRelationships },
    { rows: allTableRelationships },
    { rows: viewsKeyDependencies },
  ] = await Promise.all([
    tableRelationshipsQuery,
    schemaFilter === NON_SYSTEM_SCHEMAS_FILTER
      ? tableRelationshipsQuery
      : db.query(
          TABLE_RELATIONSHIPS_SQL({ schemaFilter: NON_SYSTEM_SCHEMAS_FILTER }),
        ),
    db.query(VIEWS_KEY_DEPENDENCIES_SQL({ schemaFilter })),
  ]);

  const emittedKeys = new Set(
    (tableRelationships as PostgresRelationship[]).map(relationshipKey),
  );
  const allViewM2oAndO2oRelationships = expandViewRelationships(
    allTableRelationships as PostgresRelationship[],
    viewsKeyDependencies as ViewKeyDependency[],
    (r) => emittedKeys.has(relationshipKey(r)),
  );

  return (tableRelationships as PostgresRelationship[]).concat(
    allViewM2oAndO2oRelationships,
  );
}

const NON_SYSTEM_SCHEMAS_FILTER = filterByList(
  undefined,
  undefined,
  DEFAULT_SYSTEM_SCHEMAS,
);

const relationshipKey = (r: PostgresRelationship) =>
  JSON.stringify([r.schema, r.relation, r.foreign_key_name]);

const keyDependencyKey = (
  tableSchema: string,
  tableName: string,
  constraintName: string,
  constraintType: ViewKeyDependency["constraint_type"],
) => JSON.stringify([tableSchema, tableName, constraintName, constraintType]);
