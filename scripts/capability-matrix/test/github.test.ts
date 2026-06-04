import { describe, it, expect } from "vitest";
import { makeRepoClient, type GetContent } from "../src/github";

describe("makeRepoClient", () => {
  it("decodes base64 file content when the path exists", async () => {
    const getContent: GetContent = async () => ({
      data: { content: Buffer.from("hello world").toString("base64"), encoding: "base64" },
    });
    const client = makeRepoClient(getContent);
    expect(await client.getFile("supabase/auth-js", "src/a.ts")).toBe("hello world");
  });

  it("returns null on a 404", async () => {
    const getContent: GetContent = async () => {
      throw Object.assign(new Error("Not Found"), { status: 404 });
    };
    const client = makeRepoClient(getContent);
    expect(await client.getFile("supabase/auth-js", "src/missing.ts")).toBeNull();
  });

  it("rethrows non-404 errors", async () => {
    const getContent: GetContent = async () => {
      throw Object.assign(new Error("rate limited"), { status: 403 });
    };
    const client = makeRepoClient(getContent);
    await expect(client.getFile("supabase/auth-js", "src/a.ts")).rejects.toThrow("rate limited");
  });

  it("forwards the ref argument to getContent", async () => {
    let recordedParams: Parameters<GetContent>[0] | undefined;
    const getContent: GetContent = async (params) => {
      recordedParams = params;
      return { data: { content: Buffer.from("ok").toString("base64"), encoding: "base64" } };
    };
    const client = makeRepoClient(getContent);
    await client.getFile("supabase/x", "a.ts", "v1.2.3");
    expect(recordedParams).toBeDefined();
    expect(recordedParams!.ref).toBe("v1.2.3");
  });
});
