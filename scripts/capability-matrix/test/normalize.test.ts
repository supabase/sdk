import { describe, it, expect } from "vitest";
import { renameWildcardParams, renameSchemas, deriveOperationId, injectOperationIds, normalizeSpec, findUnmatchedOverrides, injectRequestBodies, fixArrayTypes, stripDollarComments, stripSchemaExamples, inlineExternalRefs, dedupCaseInsensitiveProperties } from "../src/normalize";

describe("renameWildcardParams", () => {
  it("renames {*} path keys and their `*` path params", () => {
    const spec: any = {
      paths: {
        "/cdn/{bucketName}/{*}": {
          delete: { parameters: [
            { in: "path", name: "bucketName", required: true, schema: { type: "string" } },
            { in: "path", name: "*", required: true, schema: { type: "string" } },
          ] },
        },
      },
    };
    renameWildcardParams(spec, "objectPath");
    expect(spec.paths["/cdn/{bucketName}/{*}"]).toBeUndefined();
    const op = spec.paths["/cdn/{bucketName}/{objectPath}"].delete;
    expect(op.parameters.find((p: any) => p.in === "path" && p.name === "objectPath")).toBeTruthy();
    expect(op.parameters.find((p: any) => p.name === "*")).toBeUndefined();
  });
});

describe("renameSchemas", () => {
  it("leaves a schema intact when old and new names are equal", () => {
    const spec: any = { components: { schemas: { Foo: { type: "object" } } } };
    renameSchemas(spec, { Foo: "Foo" });
    expect(spec.components.schemas.Foo).toBeTruthy();
  });

  it("renames component schema keys and rewrites $refs", () => {
    const spec: any = {
      components: { schemas: { "def-1": { type: "object" } } },
      paths: { "/x": { get: { responses: { "4XX": { content: { "application/json": { schema: { $ref: "#/components/schemas/def-1" } } } } } } } },
    };
    renameSchemas(spec, { "def-1": "ErrorBody" });
    expect(spec.components.schemas["def-1"]).toBeUndefined();
    expect(spec.components.schemas["ErrorBody"]).toBeTruthy();
    expect(spec.paths["/x"].get.responses["4XX"].content["application/json"].schema.$ref).toBe("#/components/schemas/ErrorBody");
  });
});

describe("deriveOperationId", () => {
  it("derives a deterministic camelCase id", () => {
    expect(deriveOperationId("head", "/bucket")).toBe("headBucket");
    expect(deriveOperationId("get", "/bucket/{bucketId}")).toBe("getBucketByBucketId");
  });
});

describe("injectOperationIds", () => {
  it("injects derived ids, honors overrides, and keeps them unique", () => {
    const spec: any = {
      paths: {
        "/bucket": { get: {}, post: {} },
        "/object/{bucketName}/{objectPath}": { post: {} },
      },
    };
    injectOperationIds(spec, { "POST /object/{bucketName}/{objectPath}": "uploadObject" });
    expect(spec.paths["/bucket"].get.operationId).toBe("getBucket");
    expect(spec.paths["/bucket"].post.operationId).toBe("postBucket");
    expect(spec.paths["/object/{bucketName}/{objectPath}"].post.operationId).toBe("uploadObject");
  });

  it("does not overwrite an existing operationId", () => {
    const spec: any = { paths: { "/x": { get: { operationId: "keepMe" } } } };
    injectOperationIds(spec, {});
    expect(spec.paths["/x"].get.operationId).toBe("keepMe");
  });
});

describe("findUnmatchedOverrides", () => {
  it("flags override keys that match no operation", () => {
    const spec: any = { paths: { "/bucket/": { get: {}, post: {} } } };
    const unmatched = findUnmatchedOverrides(spec, { "GET /bucket/": "listBuckets", "GET /bucket": "nope", "POST /nope": "x" });
    expect(unmatched.sort()).toEqual(["GET /bucket", "POST /nope"]);
  });

  it("findUnmatchedOverrides works with object-valued maps (request body injections)", () => {
    const spec: any = { paths: { "/object/{bucketName}/{objectPath}": { post: {} } } };
    expect(findUnmatchedOverrides(spec, { "POST /object/{bucketName}/{objectPath}": { any: "object" }, "POST /nope": {} })).toEqual(["POST /nope"]);
  });
});

describe("injectRequestBodies", () => {
  const octet = { required: true, content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } } };

  it("injects a requestBody when the operation has none", () => {
    const spec: any = { paths: { "/object/{bucketName}/{objectPath}": { post: { operationId: "uploadObject" } } } };
    injectRequestBodies(spec, { "POST /object/{bucketName}/{objectPath}": octet });
    expect(spec.paths["/object/{bucketName}/{objectPath}"].post.requestBody).toEqual(octet);
  });

  it("does not overwrite an existing requestBody", () => {
    const existing = { content: { "application/json": {} } };
    const spec: any = { paths: { "/x": { post: { requestBody: existing } } } };
    injectRequestBodies(spec, { "POST /x": octet });
    expect(spec.paths["/x"].post.requestBody).toEqual(existing);
  });

  it("ignores keys whose operation does not exist", () => {
    const spec: any = { paths: { "/x": { post: {} } } };
    injectRequestBodies(spec, { "POST /nope": octet });
    expect(spec.paths["/x"].post.requestBody).toBeUndefined();
  });
});

describe("fixArrayTypes", () => {
  it("converts ['null', 'string'] to { type: 'string', nullable: true }", () => {
    const spec: any = { components: { schemas: { Foo: { type: ["null", "string"] } } } };
    fixArrayTypes(spec);
    expect(spec.components.schemas.Foo.type).toBe("string");
    expect(spec.components.schemas.Foo.nullable).toBe(true);
  });

  it("flattens single-element type array without adding nullable", () => {
    const spec: any = { components: { schemas: { Bar: { type: ["integer"] } } } };
    fixArrayTypes(spec);
    expect(spec.components.schemas.Bar.type).toBe("integer");
    expect(spec.components.schemas.Bar.nullable).toBeUndefined();
  });
});

describe("stripDollarComments", () => {
  it("removes $comment keys from schema objects", () => {
    const spec: any = { components: { schemas: { Foo: { type: "object", $comment: "internal note" } } } };
    stripDollarComments(spec);
    expect(spec.components.schemas.Foo.$comment).toBeUndefined();
    expect(spec.components.schemas.Foo.type).toBe("object");
  });
});

describe("stripSchemaExamples", () => {
  it("removes plural examples array from a schema node", () => {
    const spec: any = { components: { schemas: { Foo: { type: "integer", examples: [1, 2] } } } };
    stripSchemaExamples(spec);
    expect(spec.components.schemas.Foo.examples).toBeUndefined();
  });

  it("keeps singular example value on schema nodes", () => {
    const spec: any = { components: { schemas: { Foo: { type: "string", example: "hello" } } } };
    stripSchemaExamples(spec);
    expect(spec.components.schemas.Foo.example).toBe("hello");
  });
});

describe("inlineExternalRefs", () => {
  it("replaces HTTP $ref with inline empty object schema", () => {
    const spec: any = { paths: { "/x": { post: { requestBody: { content: { "application/json": { schema: { $ref: "https://schemas.example.com/body.json" } } } } } } } };
    inlineExternalRefs(spec);
    const schema = spec.paths["/x"].post.requestBody.content["application/json"].schema;
    expect(schema.$ref).toBeUndefined();
    expect(schema.type).toBe("object");
  });
});

describe("dedupCaseInsensitiveProperties", () => {
  it("drops the PascalCase key when a lowercase duplicate exists", () => {
    const spec: any = {
      paths: { "/x": { post: { responses: { 200: { content: { "application/json": { schema: {
        type: "object",
        properties: { Id: { type: "string" }, id: { type: "string", nullable: true }, name: { type: "string" } },
      } } } } } } } },
    };
    dedupCaseInsensitiveProperties(spec);
    const props = spec.paths["/x"].post.responses["200"].content["application/json"].schema.properties;
    expect(props.Id).toBeUndefined();
    expect(props.id).toBeTruthy();
    expect(props.name).toBeTruthy();
  });
});

describe("normalizeSpec", () => {
  it("applies wildcard rename, schema rename, then operationId injection (override keyed on normalized path)", () => {
    const spec: any = {
      components: { schemas: { "def-1": { type: "object" } } },
      paths: {
        "/object/{bucketName}/{*}": {
          post: { parameters: [
            { in: "path", name: "bucketName", required: true, schema: { type: "string" } },
            { in: "path", name: "*", required: true, schema: { type: "string" } },
          ], responses: { "4XX": { content: { "application/json": { schema: { $ref: "#/components/schemas/def-1" } } } } } },
        },
      },
    };
    normalizeSpec(spec, {
      schemaRenames: { "def-1": "ErrorBody" },
      operationIdOverrides: { "POST /object/{bucketName}/{objectPath}": "uploadObject" },
    });
    const op = spec.paths["/object/{bucketName}/{objectPath}"].post;
    expect(op.operationId).toBe("uploadObject");
    expect(op.parameters.some((p: any) => p.name === "objectPath")).toBe(true);
    expect(spec.components.schemas["ErrorBody"]).toBeTruthy();
  });
});
