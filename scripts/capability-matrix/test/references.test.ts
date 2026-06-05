import { describe, it, expect } from "vitest";
import { checkReferences, type RepoClient } from "../src/references";
import type { LoadedArea, SdkEntry } from "../src/types";

const langs = ["javascript", "flutter", "python", "swift", "csharp", "go", "kotlin"] as const;

function area(features: unknown[]): LoadedArea {
  return { file: "auth.yaml", area: { area: "auth", title: "T", description: "d", features: features as never } };
}

function feature(jsEntry: SdkEntry) {
  const sdks = Object.fromEntries(langs.map((l) => [l, { status: "not_implemented" } as SdkEntry]));
  sdks.javascript = jsEntry;
  return { id: "auth.a", name: "A", description: "d", sdks };
}

function fakeClient(files: Record<string, string | null>): RepoClient {
  return {
    async getFile(repo, path) {
      const key = `${repo}/${path}`;
      return key in files ? files[key] : null;
    },
  };
}

describe("checkReferences", () => {
  it("passes when path exists and all symbols are present", async () => {
    const f = feature({ status: "implemented", references: [{ repo: "supabase/auth-js", path: "src/a.ts", symbols: ["signInWithOtp"] }] });
    const client = fakeClient({ "supabase/auth-js/src/a.ts": "export function signInWithOtp() {}" });
    expect(await checkReferences([area([f])], client)).toEqual([]);
  });

  it("errors when the path is not found", async () => {
    const f = feature({ status: "implemented", references: [{ repo: "supabase/auth-js", path: "src/missing.ts" }] });
    const client = fakeClient({});
    const findings = await checkReferences([area([f])], client);
    expect(findings.some((x) => x.message.includes("path not found"))).toBe(true);
  });

  it("errors when a symbol is absent from the file", async () => {
    const f = feature({ status: "implemented", references: [{ repo: "supabase/auth-js", path: "src/a.ts", symbols: ["signInWithOtp"] }] });
    const client = fakeClient({ "supabase/auth-js/src/a.ts": "export function signUp() {}" });
    const findings = await checkReferences([area([f])], client);
    expect(findings.some((x) => x.message.includes('symbol "signInWithOtp" not found'))).toBe(true);
  });

  it("skips entries that are not implemented", async () => {
    const f = feature({ status: "not_implemented" });
    const client = fakeClient({});
    expect(await checkReferences([area([f])], client)).toEqual([]);
  });
});
