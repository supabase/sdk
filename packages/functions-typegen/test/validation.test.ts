import { describe, expect, test } from "bun:test";

import {
  EDGE_FUNCTIONS_METADATA_VERSION,
  type EdgeFunctionsMetadata,
  parseEdgeFunctionsMetadata,
  serializeEdgeFunctionsMetadata,
} from "../src/types.ts";

const document: EdgeFunctionsMetadata = {
  version: EDGE_FUNCTIONS_METADATA_VERSION,
  functions: [
    {
      slug: "greet",
      entrypoint: "supabase/functions/greet/index.ts",
      importMap: null,
      verifyJwt: true,
      requestBody: {
        kind: "object",
        properties: [
          { name: "name", type: { kind: "string" }, optional: false },
          {
            name: "tags",
            type: {
              kind: "array",
              element: { kind: "reference", name: "Tag" },
            },
            optional: true,
          },
        ],
        additionalProperties: { kind: "unknown" },
      },
      responseBody: {
        kind: "union",
        members: [
          { kind: "literal", value: "ok" },
          { kind: "tuple", elements: [{ kind: "number" }, { kind: "null" }] },
          {
            kind: "record",
            key: { kind: "string" },
            value: { kind: "boolean" },
          },
          { kind: "unsupported", repr: "Date" },
        ],
      },
      types: [{ name: "Tag", type: { kind: "literal", value: 1 } }],
    },
  ],
  diagnostics: [
    {
      slug: "greet",
      path: "RequestBody.when",
      message: "Date cannot be expressed as JSON.",
    },
  ],
};

describe("EdgeFunctionsMetadata schema", () => {
  test("accepts a document using every node kind and round-trips it", () => {
    const parsed = parseEdgeFunctionsMetadata(
      JSON.parse(serializeEdgeFunctionsMetadata(document)),
    );
    expect(parsed).toEqual(document);
  });

  test("rejects an unknown node kind with a readable message", () => {
    const broken = JSON.parse(serializeEdgeFunctionsMetadata(document)) as {
      functions: { requestBody: { kind: string } }[];
    };
    broken.functions[0]!.requestBody.kind = "date";
    expect(() => parseEdgeFunctionsMetadata(broken)).toThrow(
      /Invalid EdgeFunctionsMetadata: .*kind/,
    );
  });

  test("rejects another document version", () => {
    expect(() =>
      parseEdgeFunctionsMetadata({ ...document, version: 2 }),
    ).toThrow(/version must be 1/);
  });

  test("rejects a missing collection", () => {
    const { diagnostics: _diagnostics, ...withoutDiagnostics } = document;
    expect(() => parseEdgeFunctionsMetadata(withoutDiagnostics)).toThrow(
      /diagnostics/,
    );
  });
});
