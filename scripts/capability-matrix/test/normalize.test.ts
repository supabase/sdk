import { describe, it, expect } from "vitest";
import { renameWildcardParams, renameSchemas, deriveOperationId, injectOperationIds, normalizeSpec } from "../src/normalize";

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
