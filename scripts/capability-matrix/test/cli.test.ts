import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { readFileSync } from "node:fs";
import { run } from "../src/cli";

const here = dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(
  readFileSync(join(here, "..", "..", "..", "schema", "capability-matrix.schema.json"), "utf8")
);

const langs = ["javascript", "flutter", "python", "swift", "csharp", "go", "kotlin"];
function allNotImplemented() {
  return langs.map((l) => `      ${l}: { status: not_implemented }`).join("\n");
}

function tempCapabilities(yamlByName: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "capmatrix-"));
  const capDir = join(dir, "capabilities");
  mkdirSync(capDir);
  for (const [name, body] of Object.entries(yamlByName)) writeFileSync(join(capDir, name), body);
  return capDir;
}

describe("run", () => {
  it("returns 0 errors for a valid matrix in validate mode", async () => {
    const capDir = tempCapabilities({
      "auth.yaml": `area: auth\ntitle: Auth\ndescription: d\nfeatures:\n  - id: auth.a\n    name: A\n    description: d\n    sdks:\n${allNotImplemented()}\n`,
    });
    const result = await run({ mode: "validate", capabilitiesDir: capDir, schema, online: false });
    rmSync(join(capDir, ".."), { recursive: true, force: true });
    expect(result.errorCount).toBe(0);
  });

  it("returns errors for a schema-invalid matrix", async () => {
    const capDir = tempCapabilities({
      "auth.yaml": `area: auth\ntitle: Auth\ndescription: d\nfeatures:\n  - id: auth.a\n    name: A\n    description: d\n    sdks:\n      javascript: { status: not_implemented }\n`,
    });
    const result = await run({ mode: "validate", capabilitiesDir: capDir, schema, online: false });
    rmSync(join(capDir, ".."), { recursive: true, force: true });
    expect(result.errorCount).toBeGreaterThan(0);
  });

  it("produces a parity report in report mode", async () => {
    const capDir = tempCapabilities({
      "auth.yaml": `area: auth\ntitle: Auth\ndescription: d\nfeatures:\n  - id: auth.a\n    name: A\n    description: d\n    sdks:\n${allNotImplemented()}\n`,
    });
    const result = await run({ mode: "report", capabilitiesDir: capDir, schema, online: false });
    rmSync(join(capDir, ".."), { recursive: true, force: true });
    expect(result.report?.overall).toBe(0);
  });

  it("only queries references for changedFiles areas", async () => {
    const jsImpl = (repo: string, path: string) =>
      `      javascript: { status: implemented, references: [{ repo: "${repo}", path: "${path}", symbols: [mySymbol] }] }`;
    const authYaml = [
      "area: auth",
      "title: Auth",
      "description: d",
      "features:",
      "  - id: auth.a",
      "    name: A",
      "    description: d",
      "    sdks:",
      jsImpl("supabase/auth-js", "src/auth.ts"),
      ...langs.filter((l) => l !== "javascript").map((l) => `      ${l}: { status: not_implemented }`),
    ].join("\n") + "\n";
    const storageYaml = [
      "area: storage",
      "title: Storage",
      "description: d",
      "features:",
      "  - id: storage.a",
      "    name: A",
      "    description: d",
      "    sdks:",
      jsImpl("supabase/storage-js", "src/storage.ts"),
      ...langs.filter((l) => l !== "javascript").map((l) => `      ${l}: { status: not_implemented }`),
    ].join("\n") + "\n";

    const capDir = tempCapabilities({ "auth.yaml": authYaml, "storage.yaml": storageYaml });
    const queriedPairs: Array<[string, string]> = [];
    const fakeClient = {
      async getFile(repo: string, path: string): Promise<string> {
        queriedPairs.push([repo, path]);
        return "mySymbol";
      },
    };

    const authFile = join(capDir, "auth.yaml");
    const result = await run({
      mode: "validate",
      capabilitiesDir: capDir,
      schema,
      online: true,
      changedFiles: [authFile],
      repoClient: fakeClient,
    });
    rmSync(join(capDir, ".."), { recursive: true, force: true });

    // Should have queried auth-js but NOT storage-js
    expect(queriedPairs.some(([repo]) => repo === "supabase/auth-js")).toBe(true);
    expect(queriedPairs.some(([repo]) => repo === "supabase/storage-js")).toBe(false);
    expect(result.errorCount).toBe(0);
  });
});
