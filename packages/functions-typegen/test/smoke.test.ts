import { describe, expect, test } from "bun:test";

import * as pkg from "../src/index.ts";

/** Pins the public surface so the barrel stays wired up. */
describe("public API surface", () => {
  test("exports the producer, the discovery, the runner, the schema and the sort", () => {
    expect(typeof pkg.extractEdgeFunctionsMetadata).toBe("function");
    expect(typeof pkg.discoverFunctions).toBe("function");
    expect(typeof pkg.createLocalDenoRunner).toBe("function");
    expect(typeof pkg.normalizeContract).toBe("function");
    expect(typeof pkg.sortEdgeFunctionsMetadata).toBe("function");
    expect(typeof pkg.parseEdgeFunctionsMetadata).toBe("function");
    expect(typeof pkg.serializeEdgeFunctionsMetadata).toBe("function");
    expect(pkg.EDGE_FUNCTIONS_METADATA_VERSION).toBe(1);
    expect(pkg.REQUEST_BODY_EXPORT).toBe("RequestBody");
    expect(pkg.RESPONSE_BODY_EXPORT).toBe("ResponseBody");
  });
});
