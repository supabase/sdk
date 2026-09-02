import { describe, expect, test } from "bun:test";

import {
  generateTypescript as rawGenerateTypescript,
  pgTypeToTsType,
} from "../../src/generation/typescript.ts";
import { sortGeneratorMetadata } from "../../src/sort.ts";
import type {
  PostgresSchema,
  PostgresType,
  PostgresView,
} from "../../src/types.ts";
import {
  baseColumn,
  baseForeignTable,
  baseFunction,
  baseMaterializedView,
  baseRelationship,
  baseTable,
  baseView,
  buildMetadata,
  int4Type,
  textType,
  userStatusEnum,
} from "./fixtures.ts";

// Generators expect pre-sorted metadata (the caller applies the canonical sort
// pass); mirror that here so fixture construction order doesn't matter.
const generateTypescript = (
  metadata: Parameters<typeof rawGenerateTypescript>[0],
  opts?: Parameters<typeof rawGenerateTypescript>[1],
) => rawGenerateTypescript(sortGeneratorMetadata(metadata), opts);

// The generated output ends with a long, fix-independent tail (helper types
// and Constants). Tests that only assert on the Database type snapshot this
// leading section to keep the inline snapshots focused.
const databaseSection = (result: string) =>
  result.slice(0, result.indexOf("\ntype DatabaseWithoutInternals"));

describe("typescript typegen", () => {
  test("table Row/Insert/Update with enum, identity ALWAYS, default and nullable", async () => {
    const result = await generateTypescript(
      buildMetadata({
        tables: [baseTable()],
        columns: [
          baseColumn({
            name: "id",
            format: "int8",
            is_identity: true,
            identity_generation: "ALWAYS",
            ordinal_position: 1,
          }),
          baseColumn({
            name: "status",
            format: "user_status",
            is_nullable: true,
            ordinal_position: 2,
          }),
          baseColumn({ name: "label", format: "text", ordinal_position: 3 }),
          baseColumn({
            name: "score",
            format: "int4",
            default_value: "0",
            ordinal_position: 4,
          }),
          baseColumn({
            name: "meta",
            format: "jsonb",
            is_nullable: true,
            ordinal_position: 5,
          }),
        ],
      }),
    );

    expect(result).toMatchInlineSnapshot(`
      "export type Json =
        | string
        | number
        | boolean
        | null
        | { [key: string]: Json | undefined }
        | Json[]

      export type Database = {
        public: {
          Tables: {
            tickets: {
              Row: {
                id: number
                label: string
                meta: Json | null
                score: number
                status: Database["public"]["Enums"]["user_status"] | null
              }
              Insert: {
                id?: never
                label: string
                meta?: Json | null
                score?: number
                status?: Database["public"]["Enums"]["user_status"] | null
              }
              Update: {
                id?: never
                label?: string
                meta?: Json | null
                score?: number
                status?: Database["public"]["Enums"]["user_status"] | null
              }
              Relationships: []
            }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            user_status: "ACTIVE" | "INACTIVE"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
      }

      type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

      type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

      export type Tables<
        DefaultSchemaTableNameOrOptions extends
          | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
          | { schema: keyof DatabaseWithoutInternals },
        TableName extends (DefaultSchemaTableNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
              DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
          : never) = never,
      > = DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
            DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
          }
          ? R
          : never
        : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
              DefaultSchema["Views"])
          ? (DefaultSchema["Tables"] &
              DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
              Row: infer R
            }
            ? R
            : never
          : never

      export type TablesInsert<
        DefaultSchemaTableNameOrOptions extends
          | keyof DefaultSchema["Tables"]
          | { schema: keyof DatabaseWithoutInternals },
        TableName extends (DefaultSchemaTableNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
          : never) = never,
      > = DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
            Insert: infer I
          }
          ? I
          : never
        : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
          ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
              Insert: infer I
            }
            ? I
            : never
          : never

      export type TablesUpdate<
        DefaultSchemaTableNameOrOptions extends
          | keyof DefaultSchema["Tables"]
          | { schema: keyof DatabaseWithoutInternals },
        TableName extends (DefaultSchemaTableNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
          : never) = never,
      > = DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
            Update: infer U
          }
          ? U
          : never
        : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
          ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
              Update: infer U
            }
            ? U
            : never
          : never

      export type Enums<
        DefaultSchemaEnumNameOrOptions extends
          | keyof DefaultSchema["Enums"]
          | { schema: keyof DatabaseWithoutInternals },
        EnumName extends (DefaultSchemaEnumNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
          : never) = never,
      > = DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
        : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
          ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
          : never

      export type CompositeTypes<
        PublicCompositeTypeNameOrOptions extends
          | keyof DefaultSchema["CompositeTypes"]
          | { schema: keyof DatabaseWithoutInternals },
        CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
          : never) = never,
      > = PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
        : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
          ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
          : never

      export const Constants = {
        public: {
          Enums: {
            user_status: ["ACTIVE", "INACTIVE"],
          },
        },
      } as const
      "
    `);
  });

  test("omits stored generated columns from Insert and Update", async () => {
    // Ported from supabase/postgres-meta#1105: `GENERATED ALWAYS AS … STORED`
    // columns are not writable, so they stay on Row but become `?: never` on
    // Insert and Update, matching identity ALWAYS columns.
    const result = await generateTypescript(
      buildMetadata({
        tables: [baseTable()],
        columns: [
          baseColumn({
            name: "height_cm",
            format: "numeric",
            is_nullable: true,
            ordinal_position: 1,
          }),
          baseColumn({
            name: "height_in",
            format: "numeric",
            is_nullable: true,
            is_generated: true,
            is_updatable: false,
            ordinal_position: 2,
          }),
        ],
      }),
    );

    expect(databaseSection(result)).toMatchInlineSnapshot(`
      "export type Json =
        | string
        | number
        | boolean
        | null
        | { [key: string]: Json | undefined }
        | Json[]

      export type Database = {
        public: {
          Tables: {
            tickets: {
              Row: {
                height_cm: number | null
                height_in: number | null
              }
              Insert: {
                height_cm?: number | null
                height_in?: never
              }
              Update: {
                height_cm?: number | null
                height_in?: never
              }
              Relationships: []
            }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            user_status: "ACTIVE" | "INACTIVE"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
      }
      "
    `);
  });

  test("narrows a non-nullable json column to NonNullable<Json>", async () => {
    // Ported from supabase/postgres-meta#1085: the generated Json type itself
    // includes null, so a NOT NULL json/jsonb column must be narrowed with
    // NonNullable to reflect the database constraint. Nullable json columns
    // keep the plain `Json | null` union.
    const result = await generateTypescript(
      buildMetadata({
        tables: [baseTable()],
        columns: [
          baseColumn({
            name: "required_metadata",
            format: "jsonb",
            ordinal_position: 1,
          }),
          baseColumn({
            name: "optional_metadata",
            format: "jsonb",
            is_nullable: true,
            ordinal_position: 2,
          }),
        ],
      }),
    );

    expect(databaseSection(result)).toMatchInlineSnapshot(`
      "export type Json =
        | string
        | number
        | boolean
        | null
        | { [key: string]: Json | undefined }
        | Json[]

      export type Database = {
        public: {
          Tables: {
            tickets: {
              Row: {
                optional_metadata: Json | null
                required_metadata: NonNullable<Json>
              }
              Insert: {
                optional_metadata?: Json | null
                required_metadata: NonNullable<Json>
              }
              Update: {
                optional_metadata?: Json | null
                required_metadata?: NonNullable<Json>
              }
              Relationships: []
            }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            user_status: "ACTIVE" | "INACTIVE"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
      }
      "
    `);
  });

  test("resolves an enum by the column's type_schema, not the table's own schema", async () => {
    // A table in `tenant` referencing `public.user_status`, while `tenant`
    // also defines its own same-named enum with different variants. Without
    // consulting type_schema, resolution falls back to preferring an enum in
    // the table's own schema and silently picks the wrong one.
    const tenantSchema = { id: 2, name: "tenant", owner: "postgres" };
    const tenantStatusEnum = {
      ...userStatusEnum,
      id: 101,
      schema: "tenant",
      enums: ["PENDING", "DONE"],
    };
    const result = await generateTypescript(
      buildMetadata({
        schemas: [{ id: 1, name: "public", owner: "postgres" }, tenantSchema],
        types: [userStatusEnum, tenantStatusEnum],
        tables: [baseTable({ id: 2, schema: "tenant", name: "accounts" })],
        columns: [
          baseColumn({
            table_id: 2,
            schema: "tenant",
            table: "accounts",
            name: "status",
            format: "user_status",
            type_schema: "public",
            ordinal_position: 1,
          }),
        ],
      }),
    );

    expect(result).toContain(
      'status: Database["public"]["Enums"]["user_status"]',
    );
    expect(result).not.toContain(
      'status: Database["tenant"]["Enums"]["user_status"]',
    );
  });

  test("relationships without detectOneToOneRelationships omit isOneToOne", async () => {
    const result = await generateTypescript(
      buildMetadata({
        tables: [baseTable({ id: 1, name: "tickets" })],
        columns: [
          baseColumn({ table_id: 1, name: "owner_id", format: "int8" }),
        ],
        relationships: [baseRelationship()],
      }),
    );

    expect(result).not.toContain("isOneToOne");
    expect(result).toMatchInlineSnapshot(`
      "export type Json =
        | string
        | number
        | boolean
        | null
        | { [key: string]: Json | undefined }
        | Json[]

      export type Database = {
        public: {
          Tables: {
            tickets: {
              Row: {
                owner_id: number
              }
              Insert: {
                owner_id: number
              }
              Update: {
                owner_id?: number
              }
              Relationships: [
                {
                  foreignKeyName: "tickets_owner_id_fkey"
                  columns: ["owner_id"]
                  referencedRelation: "users"
                  referencedColumns: ["id"]
                },
              ]
            }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            user_status: "ACTIVE" | "INACTIVE"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
      }

      type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

      type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

      export type Tables<
        DefaultSchemaTableNameOrOptions extends
          | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
          | { schema: keyof DatabaseWithoutInternals },
        TableName extends (DefaultSchemaTableNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
              DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
          : never) = never,
      > = DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
            DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
          }
          ? R
          : never
        : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
              DefaultSchema["Views"])
          ? (DefaultSchema["Tables"] &
              DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
              Row: infer R
            }
            ? R
            : never
          : never

      export type TablesInsert<
        DefaultSchemaTableNameOrOptions extends
          | keyof DefaultSchema["Tables"]
          | { schema: keyof DatabaseWithoutInternals },
        TableName extends (DefaultSchemaTableNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
          : never) = never,
      > = DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
            Insert: infer I
          }
          ? I
          : never
        : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
          ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
              Insert: infer I
            }
            ? I
            : never
          : never

      export type TablesUpdate<
        DefaultSchemaTableNameOrOptions extends
          | keyof DefaultSchema["Tables"]
          | { schema: keyof DatabaseWithoutInternals },
        TableName extends (DefaultSchemaTableNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
          : never) = never,
      > = DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
            Update: infer U
          }
          ? U
          : never
        : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
          ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
              Update: infer U
            }
            ? U
            : never
          : never

      export type Enums<
        DefaultSchemaEnumNameOrOptions extends
          | keyof DefaultSchema["Enums"]
          | { schema: keyof DatabaseWithoutInternals },
        EnumName extends (DefaultSchemaEnumNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
          : never) = never,
      > = DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
        : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
          ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
          : never

      export type CompositeTypes<
        PublicCompositeTypeNameOrOptions extends
          | keyof DefaultSchema["CompositeTypes"]
          | { schema: keyof DatabaseWithoutInternals },
        CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
          : never) = never,
      > = PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
        : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
          ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
          : never

      export const Constants = {
        public: {
          Enums: {
            user_status: ["ACTIVE", "INACTIVE"],
          },
        },
      } as const
      "
    `);
  });

  test("relationships with detectOneToOneRelationships include isOneToOne", async () => {
    const result = await generateTypescript(
      buildMetadata({
        tables: [baseTable({ id: 1, name: "tickets" })],
        columns: [
          baseColumn({ table_id: 1, name: "owner_id", format: "int8" }),
        ],
        relationships: [baseRelationship({ is_one_to_one: true })],
      }),
      { detectOneToOneRelationships: true },
    );

    expect(result).toContain("isOneToOne: true");
    expect(result).toMatchInlineSnapshot(`
      "export type Json =
        | string
        | number
        | boolean
        | null
        | { [key: string]: Json | undefined }
        | Json[]

      export type Database = {
        public: {
          Tables: {
            tickets: {
              Row: {
                owner_id: number
              }
              Insert: {
                owner_id: number
              }
              Update: {
                owner_id?: number
              }
              Relationships: [
                {
                  foreignKeyName: "tickets_owner_id_fkey"
                  columns: ["owner_id"]
                  isOneToOne: true
                  referencedRelation: "users"
                  referencedColumns: ["id"]
                },
              ]
            }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            user_status: "ACTIVE" | "INACTIVE"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
      }

      type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

      type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

      export type Tables<
        DefaultSchemaTableNameOrOptions extends
          | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
          | { schema: keyof DatabaseWithoutInternals },
        TableName extends (DefaultSchemaTableNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
              DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
          : never) = never,
      > = DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
            DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
          }
          ? R
          : never
        : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
              DefaultSchema["Views"])
          ? (DefaultSchema["Tables"] &
              DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
              Row: infer R
            }
            ? R
            : never
          : never

      export type TablesInsert<
        DefaultSchemaTableNameOrOptions extends
          | keyof DefaultSchema["Tables"]
          | { schema: keyof DatabaseWithoutInternals },
        TableName extends (DefaultSchemaTableNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
          : never) = never,
      > = DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
            Insert: infer I
          }
          ? I
          : never
        : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
          ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
              Insert: infer I
            }
            ? I
            : never
          : never

      export type TablesUpdate<
        DefaultSchemaTableNameOrOptions extends
          | keyof DefaultSchema["Tables"]
          | { schema: keyof DatabaseWithoutInternals },
        TableName extends (DefaultSchemaTableNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
          : never) = never,
      > = DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
            Update: infer U
          }
          ? U
          : never
        : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
          ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
              Update: infer U
            }
            ? U
            : never
          : never

      export type Enums<
        DefaultSchemaEnumNameOrOptions extends
          | keyof DefaultSchema["Enums"]
          | { schema: keyof DatabaseWithoutInternals },
        EnumName extends (DefaultSchemaEnumNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
          : never) = never,
      > = DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
        : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
          ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
          : never

      export type CompositeTypes<
        PublicCompositeTypeNameOrOptions extends
          | keyof DefaultSchema["CompositeTypes"]
          | { schema: keyof DatabaseWithoutInternals },
        CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
          : never) = never,
      > = PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
        : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
          ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
          : never

      export const Constants = {
        public: {
          Enums: {
            user_status: ["ACTIVE", "INACTIVE"],
          },
        },
      } as const
      "
    `);
  });

  test("postgrestVersion emits __InternalSupabase.PostgrestVersion", async () => {
    const result = await generateTypescript(
      buildMetadata({
        tables: [baseTable()],
        columns: [baseColumn({ name: "id", format: "int8" })],
      }),
      { postgrestVersion: "12" },
    );

    expect(result).toContain('PostgrestVersion: "12"');
    expect(result).toMatchInlineSnapshot(`
      "export type Json =
        | string
        | number
        | boolean
        | null
        | { [key: string]: Json | undefined }
        | Json[]

      export type Database = {
        // Allows to automatically instantiate createClient with right options
        // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
        __InternalSupabase: {
          PostgrestVersion: "12"
        }
        public: {
          Tables: {
            tickets: {
              Row: {
                id: number
              }
              Insert: {
                id: number
              }
              Update: {
                id?: number
              }
              Relationships: []
            }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            user_status: "ACTIVE" | "INACTIVE"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
      }

      type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

      type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

      export type Tables<
        DefaultSchemaTableNameOrOptions extends
          | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
          | { schema: keyof DatabaseWithoutInternals },
        TableName extends (DefaultSchemaTableNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
              DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
          : never) = never,
      > = DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
            DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
          }
          ? R
          : never
        : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
              DefaultSchema["Views"])
          ? (DefaultSchema["Tables"] &
              DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
              Row: infer R
            }
            ? R
            : never
          : never

      export type TablesInsert<
        DefaultSchemaTableNameOrOptions extends
          | keyof DefaultSchema["Tables"]
          | { schema: keyof DatabaseWithoutInternals },
        TableName extends (DefaultSchemaTableNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
          : never) = never,
      > = DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
            Insert: infer I
          }
          ? I
          : never
        : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
          ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
              Insert: infer I
            }
            ? I
            : never
          : never

      export type TablesUpdate<
        DefaultSchemaTableNameOrOptions extends
          | keyof DefaultSchema["Tables"]
          | { schema: keyof DatabaseWithoutInternals },
        TableName extends (DefaultSchemaTableNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
          : never) = never,
      > = DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
            Update: infer U
          }
          ? U
          : never
        : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
          ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
              Update: infer U
            }
            ? U
            : never
          : never

      export type Enums<
        DefaultSchemaEnumNameOrOptions extends
          | keyof DefaultSchema["Enums"]
          | { schema: keyof DatabaseWithoutInternals },
        EnumName extends (DefaultSchemaEnumNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
          : never) = never,
      > = DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
        : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
          ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
          : never

      export type CompositeTypes<
        PublicCompositeTypeNameOrOptions extends
          | keyof DefaultSchema["CompositeTypes"]
          | { schema: keyof DatabaseWithoutInternals },
        CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
          : never) = never,
      > = PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
        : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
          ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
          : never

      export const Constants = {
        public: {
          Enums: {
            user_status: ["ACTIVE", "INACTIVE"],
          },
        },
      } as const
      "
    `);
  });

  test("function signature with args and scalar return", async () => {
    const result = await generateTypescript(
      buildMetadata({
        functions: [
          baseFunction({
            name: "add",
            args: [
              { mode: "in", name: "a", type_id: 23, has_default: false },
              { mode: "in", name: "b", type_id: 23, has_default: true },
            ],
            argument_types: "a integer, b integer",
            return_type_id: 23,
            return_type: "integer",
          }),
        ],
        types: [userStatusEnum, int4Type],
      }),
    );

    expect(result).toMatchInlineSnapshot(`
      "export type Json =
        | string
        | number
        | boolean
        | null
        | { [key: string]: Json | undefined }
        | Json[]

      export type Database = {
        public: {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            add: { Args: { a: number; b?: number }; Returns: number }
          }
          Enums: {
            user_status: "ACTIVE" | "INACTIVE"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
      }

      type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

      type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

      export type Tables<
        DefaultSchemaTableNameOrOptions extends
          | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
          | { schema: keyof DatabaseWithoutInternals },
        TableName extends (DefaultSchemaTableNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
              DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
          : never) = never,
      > = DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
            DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
          }
          ? R
          : never
        : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
              DefaultSchema["Views"])
          ? (DefaultSchema["Tables"] &
              DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
              Row: infer R
            }
            ? R
            : never
          : never

      export type TablesInsert<
        DefaultSchemaTableNameOrOptions extends
          | keyof DefaultSchema["Tables"]
          | { schema: keyof DatabaseWithoutInternals },
        TableName extends (DefaultSchemaTableNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
          : never) = never,
      > = DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
            Insert: infer I
          }
          ? I
          : never
        : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
          ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
              Insert: infer I
            }
            ? I
            : never
          : never

      export type TablesUpdate<
        DefaultSchemaTableNameOrOptions extends
          | keyof DefaultSchema["Tables"]
          | { schema: keyof DatabaseWithoutInternals },
        TableName extends (DefaultSchemaTableNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
          : never) = never,
      > = DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
            Update: infer U
          }
          ? U
          : never
        : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
          ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
              Update: infer U
            }
            ? U
            : never
          : never

      export type Enums<
        DefaultSchemaEnumNameOrOptions extends
          | keyof DefaultSchema["Enums"]
          | { schema: keyof DatabaseWithoutInternals },
        EnumName extends (DefaultSchemaEnumNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
          : never) = never,
      > = DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
        : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
          ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
          : never

      export type CompositeTypes<
        PublicCompositeTypeNameOrOptions extends
          | keyof DefaultSchema["CompositeTypes"]
          | { schema: keyof DatabaseWithoutInternals },
        CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
          : never) = never,
      > = PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
        : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
          ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
          : never

      export const Constants = {
        public: {
          Enums: {
            user_status: ["ACTIVE", "INACTIVE"],
          },
        },
      } as const
      "
    `);
  });

  test("zero-argument function emits Record<PropertyKey, never> for Args", async () => {
    // Ported from supabase/postgres-meta#1035: `Args: never` breaks
    // postgrest-js, which treats `never extends { '': Row }` as a computed
    // field and omits same-named table columns from select results, and it
    // makes the whole Database type uninhabited for tools doing sound type
    // math on it. `Record<PropertyKey, never>` is the accurate type for a
    // function callable with no arguments.
    const result = await generateTypescript(
      buildMetadata({
        functions: [baseFunction()],
        types: [userStatusEnum, int4Type],
      }),
    );

    expect(databaseSection(result)).toMatchInlineSnapshot(`
      "export type Json =
        | string
        | number
        | boolean
        | null
        | { [key: string]: Json | undefined }
        | Json[]

      export type Database = {
        public: {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            get_status: { Args: Record<PropertyKey, never>; Returns: number }
          }
          Enums: {
            user_status: "ACTIVE" | "INACTIVE"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
      }
      "
    `);
  });

  test("computed field lands in Row when its parameter is named", async () => {
    // Ported from supabase/postgres-meta#1034: computed fields were matched by
    // comparing `argument_types` — `pg_get_function_arguments()` — against the
    // table name. That string carries the parameter name when the parameter has
    // one, so `name_translated(category category)` produced `category category`
    // and never matched, dropping the field from `Row` and making
    // `.select("name_translated")` a SelectQueryError. The unnamed
    // `name_translated(category)` matched and worked, which is why this
    // reproduced for some schemas and not others. Matching on the argument's
    // composite type covers both spellings.
    const categoryRowType: PostgresType = {
      id: 500,
      name: "category",
      schema: "public",
      format: "category",
      enums: [],
      attributes: [],
      comment: null,
      // The table's own composite type points back at the table's oid.
      type_relation_id: 1,
    };
    // A variadic argument arrives as the array type, which is backed by no
    // relation and so must never be taken for a computed field.
    const categoryArrayType: PostgresType = {
      id: 501,
      name: "_category",
      schema: "public",
      format: "category[]",
      enums: [],
      attributes: [],
      comment: null,
      type_relation_id: null,
    };
    const metadata = (
      argName: string,
      mode: "in" | "inout" | "variadic" = "in",
      typeId = 500,
    ) =>
      buildMetadata({
        tables: [baseTable({ id: 1, name: "category" })],
        columns: [
          baseColumn({
            table_id: 1,
            name: "name",
            format: "text",
            ordinal_position: 1,
          }),
        ],
        functions: [
          baseFunction({
            name: "name_translated",
            args: [
              { mode, name: argName, type_id: typeId, has_default: false },
            ],
            argument_types: argName ? `${argName} category` : "category",
            identity_argument_types: "category",
            return_type_id: 25,
            return_type: "text",
          }),
        ],
        types: [userStatusEnum, textType, categoryRowType, categoryArrayType],
      });

    const named = await generateTypescript(metadata("category"));
    expect(named).toContain("name_translated: string | null");

    // The unnamed spelling already worked; keep it working.
    const unnamed = await generateTypescript(metadata(""));
    expect(unnamed).toContain("name_translated: string | null");

    // `INOUT` is a valid PostgREST computed field and counts as an input arg
    // everywhere else in this generator, so it belongs in `Row` too.
    const inout = await generateTypescript(metadata("category", "inout"));
    expect(inout).toContain("name_translated: string | null");

    // A variadic argument is an array of the row type, not the row type.
    const variadic = await generateTypescript(
      metadata("category", "variadic", 501),
    );
    expect(variadic).not.toContain("name_translated: string | null");
  });

  test("composite args on foreign tables and materialized views resolve to their Row", async () => {
    // `pgTypeToTsType` used to resolve a relation-typed value against `tables`
    // and `views` only, so an argument typed as a foreign table or as a
    // materialized view fell through to `unknown` even though both are
    // generated (foreign tables under `Tables`, materialized views under
    // `Views`) and have a `Row` to point at.
    const relationType = (
      id: number,
      name: string,
      relationId: number,
    ): PostgresType => ({
      id,
      name,
      schema: "public",
      format: name,
      enums: [],
      attributes: [],
      comment: null,
      type_relation_id: relationId,
    });
    const labelFunction = (
      id: number,
      relation: string,
      typeId: number,
      argName: string,
    ) =>
      baseFunction({
        id,
        name: `${relation}_label`,
        args: [
          { mode: "in", name: argName, type_id: typeId, has_default: false },
        ],
        argument_types: `${argName} ${relation}`,
        return_type_id: 25,
        return_type: "text",
      });

    const result = await generateTypescript(
      buildMetadata({
        foreignTables: [baseForeignTable({ id: 1, name: "remote_tickets" })],
        materializedViews: [
          baseMaterializedView({ id: 2, name: "tickets_matview" }),
        ],
        columns: [
          baseColumn({ table_id: 1, name: "id", format: "int4" }),
          baseColumn({ table_id: 2, name: "id", format: "int4" }),
        ],
        functions: [
          labelFunction(300, "remote_tickets", 500, "ft"),
          labelFunction(301, "tickets_matview", 501, "mv"),
        ],
        types: [
          userStatusEnum,
          textType,
          int4Type,
          relationType(500, "remote_tickets", 1),
          relationType(501, "tickets_matview", 2),
        ],
      }),
    );

    expect(result).toContain(
      'ft: Database["public"]["Tables"]["remote_tickets"]["Row"]',
    );
    expect(result).toContain(
      'mv: Database["public"]["Views"]["tickets_matview"]["Row"]',
    );
    expect(result).not.toContain("ft: unknown");
    expect(result).not.toContain("mv: unknown");
  });

  test("a relation-typed value resolves in its own schema before its own kind", async () => {
    // Relation-typed values carry a bare type name, so the resolver has to pick
    // between same-named relations using `preferredSchema`. It used to settle
    // the relation kind first and the schema second, which let a table-like
    // relation in an unrelated schema outrank the view the caller actually
    // meant. Harmless while only tables and views were consulted; adding
    // foreign tables and materialized views made it reachable.
    const schemas = [
      { id: 1, name: "public", owner: "postgres" },
      { id: 2, name: "other", owner: "postgres" },
    ] as PostgresSchema[];
    const resolve = (context: Parameters<typeof pgTypeToTsType>[2]) =>
      pgTypeToTsType(schemas[0]!, "foo", context);

    expect(
      resolve({
        types: [],
        schemas,
        tables: [],
        views: [baseView({ id: 10, schema: "public", name: "foo" })],
        foreignTables: [
          baseForeignTable({ id: 11, schema: "other", name: "foo" }),
        ],
      }),
    ).toBe(`Database["public"]['Views']["foo"]['Row']`);

    // Same rule the other way round: the foreign table is the one in the
    // preferred schema, so it wins over the view in the unrelated schema.
    expect(
      resolve({
        types: [],
        schemas,
        tables: [],
        views: [baseView({ id: 10, schema: "other", name: "foo" })],
        foreignTables: [
          baseForeignTable({ id: 11, schema: "public", name: "foo" }),
        ],
      }),
    ).toBe(`Database["public"]['Tables']["foo"]['Row']`);
  });

  test("a function argument resolves in the schema that owns its type", async () => {
    // Argument and return types used to be resolved without telling the
    // resolver which schema owns them, so it guessed the schema being
    // generated. The call sites already hold the resolved `PostgresType`, which
    // carries the owning schema, so they pass it: an argument genuinely typed
    // `other.foo` must not resolve to a same-named relation in `public`.
    const result = await generateTypescript(
      buildMetadata({
        schemas: [
          { id: 1, name: "public", owner: "postgres" },
          { id: 2, name: "other", owner: "postgres" },
        ],
        tables: [baseTable({ id: 20, schema: "other", name: "foo" })],
        views: [baseView({ id: 21, schema: "public", name: "foo" })],
        columns: [
          baseColumn({
            table_id: 20,
            table: "foo",
            name: "id",
            format: "int4",
          }),
          baseColumn({
            table_id: 21,
            table: "foo",
            name: "id",
            format: "int4",
          }),
        ],
        functions: [
          baseFunction({
            id: 310,
            schema: "public",
            name: "describe",
            args: [{ mode: "in", name: "a", type_id: 500, has_default: false }],
            argument_types: "a other.foo",
            return_type_id: 25,
            return_type: "text",
          }),
        ],
        types: [
          userStatusEnum,
          textType,
          int4Type,
          {
            id: 500,
            name: "foo",
            schema: "other",
            format: "foo",
            enums: [],
            attributes: [],
            comment: null,
            type_relation_id: 20,
          },
        ],
      }),
    );

    expect(result).toContain('a: Database["other"]["Tables"]["foo"]["Row"]');
    expect(result).not.toContain(
      'a: Database["public"]["Views"]["foo"]["Row"]',
    );
  });

  test("types owned by a schema that is not generated fall back rather than dangle", async () => {
    // A column can reference an enum, a composite type or a relation that lives
    // in a schema the caller did not ask to generate. Emitting
    // `Database["other"][...]` there would dangle, because no `other` key is
    // written, so each kind degrades instead: an enum inlines its variants as a
    // string union (the values travel with the type, so nothing is lost) while
    // composites and relations, whose shape lives in the schema that was
    // skipped, go to `unknown`.
    const outsideEnum: PostgresType = {
      id: 600,
      name: "mood",
      schema: "other",
      format: "mood",
      enums: ["happy", "sad"],
      attributes: [],
      comment: null,
      type_relation_id: null,
    };
    const outsideComposite: PostgresType = {
      id: 601,
      name: "point3",
      schema: "other",
      format: "point3",
      enums: [],
      attributes: [{ name: "x", type_id: 23 }],
      comment: null,
      type_relation_id: null,
    };
    const column = (position: number, name: string, format: string) =>
      baseColumn({
        table_id: 1,
        table: "holder",
        ordinal_position: position,
        name,
        format,
        type_schema: "other",
        is_nullable: true,
      });

    const result = await generateTypescript(
      buildMetadata({
        // `other` is deliberately absent from `schemas`, while types and
        // relations belonging to it are still in the metadata. `introspect()`
        // produces the type half of that itself: it filters relations by
        // schema but queries `types` with no filter at all, so an
        // out-of-schema enum or composite arrives on the canonical path. The
        // relation half only arrives from a custom `GeneratorMetadata`
        // producer, which the contract explicitly allows.
        schemas: [{ id: 1, name: "public", owner: "postgres" }],
        tables: [
          baseTable({ id: 1, name: "holder" }),
          baseTable({ id: 20, schema: "other", name: "remote" }),
        ],
        views: [baseView({ id: 21, schema: "other", name: "remote_view" })],
        columns: [
          column(1, "mood_col", "mood"),
          column(2, "point_col", "point3"),
          column(3, "row_col", "remote"),
          column(4, "view_col", "remote_view"),
        ],
        types: [userStatusEnum, textType, outsideEnum, outsideComposite],
      }),
    );

    expect(result).toContain('mood_col: "happy" | "sad" | null');
    expect(result).toContain("point_col: unknown");
    expect(result).toContain("row_col: unknown");
    expect(result).toContain("view_col: unknown");
    // Nothing may reference the schema that was never generated.
    expect(result).not.toContain('Database["other"]');
  });

  test("a non-updatable column on a writable view is `never` in Update", async () => {
    // A view can be writable overall while individual columns are not, for
    // instance a computed expression alongside plain passthrough columns. Those
    // columns have to be spelled `?: never` so writing one is a type error
    // rather than a runtime rejection. The Insert side of this is already
    // covered; the Update side was not.
    const result = await generateTypescript(
      buildMetadata({
        views: [
          baseView({ id: 30, name: "editable_view", is_update_enabled: true }),
        ],
        columns: [
          baseColumn({
            table_id: 30,
            table: "editable_view",
            ordinal_position: 1,
            name: "writable",
            is_nullable: true,
          }),
          baseColumn({
            table_id: 30,
            table: "editable_view",
            ordinal_position: 2,
            name: "computed",
            is_nullable: true,
            is_updatable: false,
          }),
        ],
      }),
    );

    const update = result.slice(result.indexOf("Update: {"));
    expect(update).toContain("computed?: never");
    expect(update).toContain("writable?: string | null");
  });

  test("views emit Insert and Update independently based on trigger-aware writability", async () => {
    // Ported from supabase/postgres-meta#1062 (improved): views made writable
    // by INSTEAD OF triggers get Insert/Update types even though they are not
    // auto-updatable, and the two are gated independently so a view with only
    // an INSTEAD OF INSERT trigger gets only an Insert type.
    const viewColumn = (
      tableId: number,
      view: string,
      overrides: Parameters<typeof baseColumn>[0] = {},
    ) =>
      baseColumn({
        table_id: tableId,
        table: view,
        name: "id",
        format: "int8",
        is_nullable: true,
        ...overrides,
      });
    const result = await generateTypescript(
      buildMetadata({
        views: [
          baseView({
            id: 1,
            name: "insert_only_view",
            is_insert_enabled: true,
          }),
          baseView({
            id: 2,
            name: "update_only_view",
            is_update_enabled: true,
          }),
          baseView({
            id: 3,
            name: "auto_updatable_view",
            is_updatable: true,
            is_insert_enabled: true,
            is_update_enabled: true,
          }),
          baseView({ id: 4, name: "read_only_view" }),
        ],
        columns: [
          viewColumn(1, "insert_only_view"),
          viewColumn(1, "insert_only_view", {
            name: "derived",
            format: "text",
            is_updatable: false,
            ordinal_position: 2,
          }),
          viewColumn(2, "update_only_view"),
          viewColumn(3, "auto_updatable_view"),
          viewColumn(4, "read_only_view"),
        ],
      }),
    );

    expect(databaseSection(result)).toMatchInlineSnapshot(`
      "export type Json =
        | string
        | number
        | boolean
        | null
        | { [key: string]: Json | undefined }
        | Json[]

      export type Database = {
        public: {
          Tables: {
            [_ in never]: never
          }
          Views: {
            auto_updatable_view: {
              Row: {
                id: number | null
              }
              Insert: {
                id?: number | null
              }
              Update: {
                id?: number | null
              }
              Relationships: []
            }
            insert_only_view: {
              Row: {
                derived: string | null
                id: number | null
              }
              Insert: {
                derived?: never
                id?: number | null
              }
              Relationships: []
            }
            read_only_view: {
              Row: {
                id: number | null
              }
              Relationships: []
            }
            update_only_view: {
              Row: {
                id: number | null
              }
              Update: {
                id?: number | null
              }
              Relationships: []
            }
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            user_status: "ACTIVE" | "INACTIVE"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
      }
      "
    `);
  });

  test("views without the trigger-aware flags fall back to is_updatable", async () => {
    // Version 1 metadata produced before is_insert_enabled and
    // is_update_enabled existed must keep the original contract: an
    // auto-updatable view gets both Insert and Update, a non-updatable view
    // gets neither.
    const legacyView = (
      overrides: Partial<Omit<PostgresView, "columns">>,
    ): Omit<PostgresView, "columns"> => {
      const {
        is_insert_enabled: _insertFlag,
        is_update_enabled: _updateFlag,
        ...view
      } = baseView(overrides);
      return view;
    };
    const result = await generateTypescript(
      buildMetadata({
        views: [
          legacyView({ id: 1, name: "legacy_updatable", is_updatable: true }),
          legacyView({ id: 2, name: "legacy_read_only" }),
        ],
        columns: [
          baseColumn({
            table_id: 1,
            table: "legacy_updatable",
            name: "id",
            format: "int8",
            is_nullable: true,
          }),
          baseColumn({
            table_id: 2,
            table: "legacy_read_only",
            name: "id",
            format: "int8",
            is_nullable: true,
          }),
        ],
      }),
    );

    expect(databaseSection(result)).toMatchInlineSnapshot(`
      "export type Json =
        | string
        | number
        | boolean
        | null
        | { [key: string]: Json | undefined }
        | Json[]

      export type Database = {
        public: {
          Tables: {
            [_ in never]: never
          }
          Views: {
            legacy_read_only: {
              Row: {
                id: number | null
              }
              Relationships: []
            }
            legacy_updatable: {
              Row: {
                id: number | null
              }
              Insert: {
                id?: number | null
              }
              Update: {
                id?: number | null
              }
              Relationships: []
            }
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            user_status: "ACTIVE" | "INACTIVE"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
      }
      "
    `);
  });

  test("defaultSchema option targets a non-public schema", async () => {
    const result = await generateTypescript(
      buildMetadata({
        schemas: [{ id: 2, name: "api", owner: "postgres" }],
        tables: [baseTable({ id: 1, schema: "api", name: "widgets" })],
        columns: [
          baseColumn({
            table_id: 1,
            schema: "api",
            name: "id",
            format: "int8",
          }),
        ],
        types: [],
      }),
      { defaultSchema: "api" },
    );

    expect(result).toContain('Extract<keyof Database, "api">');
    expect(result).toMatchInlineSnapshot(`
      "export type Json =
        | string
        | number
        | boolean
        | null
        | { [key: string]: Json | undefined }
        | Json[]

      export type Database = {
        api: {
          Tables: {
            widgets: {
              Row: {
                id: number
              }
              Insert: {
                id: number
              }
              Update: {
                id?: number
              }
              Relationships: []
            }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
      }

      type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

      type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "api">]

      export type Tables<
        DefaultSchemaTableNameOrOptions extends
          | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
          | { schema: keyof DatabaseWithoutInternals },
        TableName extends (DefaultSchemaTableNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
              DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
          : never) = never,
      > = DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
            DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
          }
          ? R
          : never
        : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
              DefaultSchema["Views"])
          ? (DefaultSchema["Tables"] &
              DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
              Row: infer R
            }
            ? R
            : never
          : never

      export type TablesInsert<
        DefaultSchemaTableNameOrOptions extends
          | keyof DefaultSchema["Tables"]
          | { schema: keyof DatabaseWithoutInternals },
        TableName extends (DefaultSchemaTableNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
          : never) = never,
      > = DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
            Insert: infer I
          }
          ? I
          : never
        : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
          ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
              Insert: infer I
            }
            ? I
            : never
          : never

      export type TablesUpdate<
        DefaultSchemaTableNameOrOptions extends
          | keyof DefaultSchema["Tables"]
          | { schema: keyof DatabaseWithoutInternals },
        TableName extends (DefaultSchemaTableNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
          : never) = never,
      > = DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
            Update: infer U
          }
          ? U
          : never
        : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
          ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
              Update: infer U
            }
            ? U
            : never
          : never

      export type Enums<
        DefaultSchemaEnumNameOrOptions extends
          | keyof DefaultSchema["Enums"]
          | { schema: keyof DatabaseWithoutInternals },
        EnumName extends (DefaultSchemaEnumNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
          : never) = never,
      > = DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
        : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
          ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
          : never

      export type CompositeTypes<
        PublicCompositeTypeNameOrOptions extends
          | keyof DefaultSchema["CompositeTypes"]
          | { schema: keyof DatabaseWithoutInternals },
        CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
          schema: keyof DatabaseWithoutInternals
        }
          ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
          : never) = never,
      > = PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
      }
        ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
        : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
          ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
          : never

      export const Constants = {
        api: {
          Enums: {},
        },
      } as const
      "
    `);
  });

  test("format option substitutes the default oxfmt formatter", async () => {
    const calls: string[] = [];
    const result = await generateTypescript(
      buildMetadata({
        tables: [baseTable()],
        columns: [baseColumn({ name: "id", format: "int8" })],
      }),
      {
        format: async (code) => {
          calls.push(code);
          return "// formatted by custom formatter\n";
        },
      },
    );

    expect(calls).toHaveLength(1);
    expect(result).toBe("// formatted by custom formatter\n");
  });
});
