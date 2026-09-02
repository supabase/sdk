import { describe, expect, test } from "bun:test";

import { generateSwift as rawGenerateSwift } from "../../src/generation/swift.ts";
import { sortGeneratorMetadata } from "../../src/sort.ts";
import {
  addressCompositeType,
  baseColumn,
  baseTable,
  baseView,
  buildMetadata,
  textType,
  userStatusEnum,
} from "./fixtures.ts";

// Generators expect pre-sorted metadata (the caller applies the canonical sort
// pass); mirror that here so fixture construction order doesn't matter.
const generateSwift = (
  metadata: Parameters<typeof rawGenerateSwift>[0],
  opts?: Parameters<typeof rawGenerateSwift>[1],
) => rawGenerateSwift(sortGeneratorMetadata(metadata), opts);

describe("swift typegen", () => {
  test("enum, struct operations, identity and CodingKeys", () => {
    const result = generateSwift(
      buildMetadata({
        tables: [baseTable()],
        columns: [
          baseColumn({
            name: "id",
            format: "int8",
            is_identity: true,
            ordinal_position: 1,
          }),
          baseColumn({
            name: "status",
            format: "user_status",
            is_nullable: true,
            ordinal_position: 2,
          }),
          baseColumn({ name: "label", format: "text", ordinal_position: 3 }),
        ],
      }),
    );

    expect(result).toMatchInlineSnapshot(`
      "import Foundation
      import Supabase

      internal enum PublicSchema {
        internal enum UserStatus: String, Codable, Hashable, Sendable {
          case active = "ACTIVE"
          case inactive = "INACTIVE"
        }
        internal struct TicketsSelect: Codable, Hashable, Sendable, Identifiable {
          internal let id: Int64
          internal let label: String
          internal let status: UserStatus?
          internal enum CodingKeys: String, CodingKey {
            case id = "id"
            case label = "label"
            case status = "status"
          }
        }
        internal struct TicketsInsert: Codable, Hashable, Sendable, Identifiable {
          internal let id: Int64?
          internal let label: String
          internal let status: UserStatus?
          internal enum CodingKeys: String, CodingKey {
            case id = "id"
            case label = "label"
            case status = "status"
          }
        }
        internal struct TicketsUpdate: Codable, Hashable, Sendable, Identifiable {
          internal let id: Int64?
          internal let label: String?
          internal let status: UserStatus?
          internal enum CodingKeys: String, CodingKey {
            case id = "id"
            case label = "label"
            case status = "status"
          }
        }
      }"
    `);
  });

  test("views and composite types", () => {
    const result = generateSwift(
      buildMetadata({
        types: [userStatusEnum, textType, addressCompositeType],
        views: [baseView({ id: 2, name: "tickets_view" })],
        columns: [
          baseColumn({
            table_id: 2,
            name: "b",
            format: "int4",
            is_nullable: true,
          }),
        ],
      }),
    );

    expect(result).toMatchInlineSnapshot(`
      "import Foundation
      import Supabase

      internal enum PublicSchema {
        internal enum UserStatus: String, Codable, Hashable, Sendable {
          case active = "ACTIVE"
          case inactive = "INACTIVE"
        }
        internal struct TicketsViewSelect: Codable, Hashable, Sendable {
          internal let b: Int32?
          internal enum CodingKeys: String, CodingKey {
            case b = "b"
          }
        }
        internal struct Address: Codable, Hashable, Sendable {
          internal let Street: String
          internal let City: String
          internal enum CodingKeys: String, CodingKey {
            case Street = "street"
            case City = "city"
          }
        }
      }"
    `);
  });

  test("accessControl: public", () => {
    const result = generateSwift(
      buildMetadata({
        tables: [baseTable()],
        columns: [baseColumn({ name: "id", format: "int8" })],
      }),
      { accessControl: "public" },
    );

    expect(result).toMatchInlineSnapshot(`
      "import Foundation
      import Supabase

      public enum PublicSchema {
        public enum UserStatus: String, Codable, Hashable, Sendable {
          case active = "ACTIVE"
          case inactive = "INACTIVE"
        }
        public struct TicketsSelect: Codable, Hashable, Sendable {
          public let id: Int64
          public enum CodingKeys: String, CodingKey {
            case id = "id"
          }
        }
        public struct TicketsInsert: Codable, Hashable, Sendable {
          public let id: Int64
          public enum CodingKeys: String, CodingKey {
            case id = "id"
          }
        }
        public struct TicketsUpdate: Codable, Hashable, Sendable {
          public let id: Int64?
          public enum CodingKeys: String, CodingKey {
            case id = "id"
          }
        }
      }"
    `);
  });

  test("escapes string literals for pathological enum labels and column names", () => {
    const result = generateSwift(
      buildMetadata({
        types: [
          {
            id: 100,
            name: "hazard",
            schema: "public",
            format: "hazard",
            enums: [
              'say "hi"',
              "back\\slash",
              "interpolate \\(now)",
              "line\nbreak",
              "tab\there",
              "carriage\rreturn",
              "bell\u0007sound",
              "line\u2028separator",
            ],
            attributes: [],
            comment: null,
            type_relation_id: null,
          },
        ],
        tables: [baseTable()],
        columns: [
          baseColumn({ name: 'quote"col', ordinal_position: 1 }),
          baseColumn({ name: "path\\col", ordinal_position: 2 }),
        ],
      }),
    );

    expect(result).toMatchInlineSnapshot(`
      "import Foundation
      import Supabase

      internal enum PublicSchema {
        internal enum Hazard: String, Codable, Hashable, Sendable {
          case sayHi = "say \\"hi\\""
          case backSlash = "back\\\\slash"
          case interpolateNow = "interpolate \\\\(now)"
          case lineBreak = "line\\nbreak"
          case tabHere = "tab\\there"
          case carriageReturn = "carriage\\rreturn"
          case bellSound = "bell\\u{7}sound"
          case lineSeparator = "line\\u{2028}separator"
        }
        internal struct TicketsSelect: Codable, Hashable, Sendable {
          internal let pathCol: String
          internal let quoteCol: String
          internal enum CodingKeys: String, CodingKey {
            case pathCol = "path\\\\col"
            case quoteCol = "quote\\"col"
          }
        }
        internal struct TicketsInsert: Codable, Hashable, Sendable {
          internal let pathCol: String
          internal let quoteCol: String
          internal enum CodingKeys: String, CodingKey {
            case pathCol = "path\\\\col"
            case quoteCol = "quote\\"col"
          }
        }
        internal struct TicketsUpdate: Codable, Hashable, Sendable {
          internal let pathCol: String?
          internal let quoteCol: String?
          internal enum CodingKeys: String, CodingKey {
            case pathCol = "path\\\\col"
            case quoteCol = "quote\\"col"
          }
        }
      }"
    `);
  });

  test("leaves ordinary raw values unescaped", () => {
    const result = generateSwift(
      buildMetadata({
        tables: [baseTable()],
        columns: [baseColumn({ name: "plain_name" })],
      }),
    );

    expect(result).toContain('case plainName = "plain_name"');
  });

  test("a leading underscore in a type name is preserved", () => {
    // `formatForSwiftTypeName` pascal-cases each word, which would eat a
    // leading underscore, so it is stripped and put back. Postgres names its
    // implicit array types that way (`_int4`), and a table or enum may be named
    // so deliberately, and the resulting Swift name has to stay distinct from
    // the one without it.
    const result = generateSwift(
      buildMetadata({
        tables: [baseTable({ id: 1, name: "_key_id_context" })],
        columns: [
          baseColumn({
            table_id: 1,
            table: "_key_id_context",
            name: "id",
            format: "int8",
            ordinal_position: 1,
          }),
        ],
      }),
    );

    expect(result).toContain("struct _KeyIdContextSelect");
    expect(result).not.toContain("struct KeyIdContextSelect");
  });

  test("separators that produce empty words are dropped, not capitalised", () => {
    // The split pattern matches a *run* of non-alphanumerics, so `a--b` yields
    // two words, not three: only a leading or trailing separator produces an
    // empty string. `__weird--name_` produces two of them, one from the
    // underscore left after the prefix is stripped and one from the trailing
    // underscore. They have to contribute nothing, otherwise the name picks up
    // stray characters or throws on `word[0]`.
    const result = generateSwift(
      buildMetadata({
        tables: [baseTable({ id: 1, name: "__weird--name_" })],
        columns: [
          baseColumn({
            table_id: 1,
            table: "__weird--name_",
            name: "id",
            format: "int8",
            ordinal_position: 1,
          }),
        ],
      }),
    );

    expect(result).toContain("struct _WeirdNameSelect");
  });

  test("array and uuid types", () => {
    const result = generateSwift(
      buildMetadata({
        tables: [baseTable()],
        columns: [
          baseColumn({ name: "id", format: "uuid", ordinal_position: 1 }),
          baseColumn({
            name: "tags",
            format: "_text",
            is_nullable: true,
            ordinal_position: 2,
          }),
        ],
      }),
    );

    expect(result).toMatchInlineSnapshot(`
      "import Foundation
      import Supabase

      internal enum PublicSchema {
        internal enum UserStatus: String, Codable, Hashable, Sendable {
          case active = "ACTIVE"
          case inactive = "INACTIVE"
        }
        internal struct TicketsSelect: Codable, Hashable, Sendable {
          internal let id: UUID
          internal let tags: [String]?
          internal enum CodingKeys: String, CodingKey {
            case id = "id"
            case tags = "tags"
          }
        }
        internal struct TicketsInsert: Codable, Hashable, Sendable {
          internal let id: UUID
          internal let tags: [String]?
          internal enum CodingKeys: String, CodingKey {
            case id = "id"
            case tags = "tags"
          }
        }
        internal struct TicketsUpdate: Codable, Hashable, Sendable {
          internal let id: UUID?
          internal let tags: [String]?
          internal enum CodingKeys: String, CodingKey {
            case id = "id"
            case tags = "tags"
          }
        }
      }"
    `);
  });
});
