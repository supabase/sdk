import { describe, it, expect } from "vitest";
import { checkReferences, type RepoClient } from "../src/references";
import type { LoadedArea } from "../src/types";

function area(): LoadedArea {
  return { file: "auth.yaml", area: { area: "auth", title: "T", description: "d", features: [] } };
}

function fakeClient(): RepoClient {
  return { async getFile() { return null; } };
}

describe("checkReferences", () => {
  it("always returns no findings (references moved to compliance files)", async () => {
    expect(await checkReferences([area()], fakeClient())).toEqual([]);
  });
});
