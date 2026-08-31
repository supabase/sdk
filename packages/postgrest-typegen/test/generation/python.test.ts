import { describe, expect, test } from "bun:test";

import { generatePython as rawGeneratePython } from "../../src/generation/python.ts";
import { sortGeneratorMetadata } from "../../src/sort.ts";
import {
  addressCompositeType,
  baseColumn,
  baseMaterializedView,
  baseTable,
  baseView,
  buildMetadata,
  textType,
  userStatusEnum,
} from "./fixtures.ts";

// Generators expect pre-sorted metadata (the caller applies the canonical sort
// pass); mirror that here so fixture construction order doesn't matter.
const generatePython = (metadata: Parameters<typeof rawGeneratePython>[0]) =>
  rawGeneratePython(sortGeneratorMetadata(metadata));

describe("python typegen", () => {
  test("table with nullability, identity, generated and default columns", () => {
    const result = generatePython(
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
          baseColumn({
            name: "computed",
            format: "text",
            is_generated: true,
            ordinal_position: 4,
          }),
          baseColumn({
            name: "with_default",
            format: "int4",
            default_value: "0",
            ordinal_position: 5,
          }),
        ],
      }),
    );

    expect(result).toMatchInlineSnapshot(`
      "from __future__ import annotations

      import datetime
      import uuid
      from typing import (
          Annotated,
          Any,
          List,
          Literal,
          Optional,
          TypedDict,
      )
      from typing_extensions import NotRequired, TypeAlias

      from pydantic import BaseModel, Field, JsonValue

      PublicUserStatus: TypeAlias = Literal["ACTIVE", "INACTIVE"]

      class PublicTickets(BaseModel):
          computed: str = Field(alias="computed")
          id: int = Field(alias="id")
          label: str = Field(alias="label")
          status: Optional[PublicUserStatus] = Field(alias="status")
          with_default: int = Field(alias="with_default")

      class PublicTicketsInsert(TypedDict):
          computed: Annotated[str, Field(alias="computed")]
          id: NotRequired[Annotated[int, Field(alias="id")]]
          label: Annotated[str, Field(alias="label")]
          status: NotRequired[Annotated[Optional[PublicUserStatus], Field(alias="status")]]
          with_default: NotRequired[Annotated[int, Field(alias="with_default")]]

      class PublicTicketsUpdate(TypedDict):
          computed: NotRequired[Annotated[str, Field(alias="computed")]]
          id: NotRequired[Annotated[int, Field(alias="id")]]
          label: NotRequired[Annotated[str, Field(alias="label")]]
          status: NotRequired[Annotated[Optional[PublicUserStatus], Field(alias="status")]]
          with_default: NotRequired[Annotated[int, Field(alias="with_default")]]"
    `);
  });

  test("views and materialized views", () => {
    const result = generatePython(
      buildMetadata({
        tables: [baseTable({ id: 1, name: "tickets" })],
        views: [baseView({ id: 2, name: "tickets_view" })],
        materializedViews: [
          baseMaterializedView({ id: 3, name: "tickets_mv" }),
        ],
        columns: [
          baseColumn({ table_id: 1, name: "a", format: "text" }),
          baseColumn({
            table_id: 2,
            name: "b",
            format: "int4",
            is_nullable: true,
          }),
          baseColumn({ table_id: 3, name: "c", format: "bool" }),
        ],
      }),
    );

    expect(result).toMatchInlineSnapshot(`
      "from __future__ import annotations

      import datetime
      import uuid
      from typing import (
          Annotated,
          Any,
          List,
          Literal,
          Optional,
          TypedDict,
      )
      from typing_extensions import NotRequired, TypeAlias

      from pydantic import BaseModel, Field, JsonValue

      PublicUserStatus: TypeAlias = Literal["ACTIVE", "INACTIVE"]

      class PublicTickets(BaseModel):
          a: str = Field(alias="a")

      class PublicTicketsInsert(TypedDict):
          a: Annotated[str, Field(alias="a")]

      class PublicTicketsUpdate(TypedDict):
          a: NotRequired[Annotated[str, Field(alias="a")]]

      class PublicTicketsView(BaseModel):
          b: Optional[int] = Field(alias="b")

      class PublicTicketsMv(BaseModel):
          c: bool = Field(alias="c")"
    `);
  });

  test("enum alias and composite type", () => {
    const result = generatePython(
      buildMetadata({
        types: [userStatusEnum, textType, addressCompositeType],
      }),
    );

    // Composite type attributes cannot carry NOT NULL constraints in
    // Postgres, so every field must be Optional.
    expect(result).toContain('street: Optional[str] = Field(alias="street")');

    expect(result).toMatchInlineSnapshot(`
      "from __future__ import annotations

      import datetime
      import uuid
      from typing import (
          Annotated,
          Any,
          List,
          Literal,
          Optional,
          TypedDict,
      )
      from typing_extensions import NotRequired, TypeAlias

      from pydantic import BaseModel, Field, JsonValue

      PublicUserStatus: TypeAlias = Literal["ACTIVE", "INACTIVE"]







      class PublicAddress(BaseModel):
          street: Optional[str] = Field(alias="street")
          city: Optional[str] = Field(alias="city")"
    `);
  });

  test("NotRequired and TypeAlias come from typing_extensions for Python 3.9 support", () => {
    const result = generatePython(buildMetadata());
    const typingImport = result.match(/from typing import \(([\s\S]*?)\)/)?.[1];

    expect(typingImport).toBeDefined();
    expect(typingImport).not.toContain("NotRequired");
    expect(typingImport).not.toContain("TypeAlias");
    expect(result).toContain(
      "from typing_extensions import NotRequired, TypeAlias",
    );
  });

  test("json and jsonb columns accept deserialized values via JsonValue", () => {
    const result = generatePython(
      buildMetadata({
        tables: [baseTable()],
        columns: [
          baseColumn({ name: "payload", format: "json", ordinal_position: 1 }),
          baseColumn({
            name: "settings",
            format: "jsonb",
            is_nullable: true,
            ordinal_position: 2,
          }),
        ],
      }),
    );

    expect(result).toContain(
      "from pydantic import BaseModel, Field, JsonValue",
    );
    expect(result).toContain('payload: JsonValue = Field(alias="payload")');
    expect(result).toContain(
      'settings: Optional[JsonValue] = Field(alias="settings")',
    );
    expect(result).not.toContain("Json[Any]");
  });

  test("enum labels with quotes, backslashes and newlines are escaped", () => {
    const result = generatePython(
      buildMetadata({
        types: [
          { ...userStatusEnum, enums: ['a";b', "back\\slash", "new\nline"] },
          textType,
        ],
      }),
    );

    expect(result).toContain(
      'Literal["a\\";b", "back\\\\slash", "new\\nline"]',
    );
    expect(result).not.toContain('Literal["a";b"');
  });

  test("column names with quotes are escaped in Field aliases", () => {
    const result = generatePython(
      buildMetadata({
        tables: [baseTable()],
        columns: [baseColumn({ name: 'quo"ted' })],
      }),
    );

    expect(result).toContain('quo_ted: str = Field(alias="quo\\"ted")');
    expect(result).toContain('Annotated[str, Field(alias="quo\\"ted")]');
    expect(result).not.toContain('alias="quo"ted"');
  });

  test("array column resolves to List[...] and multi-word names are normalized", () => {
    const result = generatePython(
      buildMetadata({
        tables: [baseTable()],
        columns: [
          baseColumn({
            name: "tags",
            format: "_user_status",
            is_nullable: false,
          }),
          baseColumn({ name: "names", format: "_text", is_nullable: true }),
          baseColumn({ name: "victory road", format: "text" }),
        ],
      }),
    );

    expect(result).toMatchInlineSnapshot(`
      "from __future__ import annotations

      import datetime
      import uuid
      from typing import (
          Annotated,
          Any,
          List,
          Literal,
          Optional,
          TypedDict,
      )
      from typing_extensions import NotRequired, TypeAlias

      from pydantic import BaseModel, Field, JsonValue

      PublicUserStatus: TypeAlias = Literal["ACTIVE", "INACTIVE"]

      class PublicTickets(BaseModel):
          names: Optional[List[str]] = Field(alias="names")
          tags: List[PublicUserStatus] = Field(alias="tags")
          victory_road: str = Field(alias="victory road")

      class PublicTicketsInsert(TypedDict):
          names: NotRequired[Annotated[Optional[List[str]], Field(alias="names")]]
          tags: Annotated[List[PublicUserStatus], Field(alias="tags")]
          victory_road: Annotated[str, Field(alias="victory road")]

      class PublicTicketsUpdate(TypedDict):
          names: NotRequired[Annotated[Optional[List[str]], Field(alias="names")]]
          tags: NotRequired[Annotated[List[PublicUserStatus], Field(alias="tags")]]
          victory_road: NotRequired[Annotated[str, Field(alias="victory road")]]"
    `);
  });
});
