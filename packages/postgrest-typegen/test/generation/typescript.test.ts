import { describe, expect, test } from "bun:test";

import { generateTypescript as rawGenerateTypescript } from "../../src/generation/typescript.ts";
import { sortGeneratorMetadata } from "../../src/sort.ts";
import type { PostgresView } from "../../src/types.ts";
import {
  baseColumn,
  baseFunction,
  baseRelationship,
  baseTable,
  baseView,
  buildMetadata,
  int4Type,
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
