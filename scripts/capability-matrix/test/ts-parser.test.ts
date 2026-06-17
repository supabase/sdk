import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { extractFromSource, parseTypeScriptProject } from "../src/ts-parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, "fixtures", "ts-sample");

describe("extractFromSource", () => {
  it("extracts exported class and its public methods", () => {
    const source = `
      export class AuthClient {
        public signUp(email: string): void {}
        public signIn(): void {}
      }
    `;
    const symbols = extractFromSource(source, "src/index.ts");
    const names = symbols.map((s) => s.name);
    expect(names).toContain("AuthClient");
    expect(names).toContain("AuthClient.signUp");
    expect(names).toContain("AuthClient.signIn");
  });

  it("excludes private and protected members", () => {
    const source = `
      export class Foo {
        public pub(): void {}
        private priv(): void {}
        protected prot(): void {}
        #hard = 1;
      }
    `;
    const symbols = extractFromSource(source, "src/index.ts");
    const names = symbols.map((s) => s.name);
    expect(names).toContain("Foo.pub");
    expect(names).not.toContain("Foo.priv");
    expect(names).not.toContain("Foo.prot");
    expect(names).not.toContain("Foo.#hard");
  });

  it("excludes non-exported classes", () => {
    const source = `
      class Internal {
        public method(): void {}
      }
    `;
    const symbols = extractFromSource(source, "src/index.ts");
    expect(symbols).toHaveLength(0);
  });

  it("extracts exported functions", () => {
    const source = `export function createClient(url: string): void {}`;
    const symbols = extractFromSource(source, "src/index.ts");
    expect(symbols).toEqual([{ name: "createClient", kind: "function", file: "src/index.ts" }]);
  });

  it("extracts exported variables", () => {
    const source = `export const version = "1.0.0";`;
    const symbols = extractFromSource(source, "src/index.ts");
    expect(symbols).toEqual([{ name: "version", kind: "variable", file: "src/index.ts" }]);
  });

  it("skips constructor", () => {
    const source = `
      export class Foo {
        constructor(private x: number) {}
        public bar(): void {}
      }
    `;
    const symbols = extractFromSource(source, "src/index.ts");
    const names = symbols.map((s) => s.name);
    expect(names).not.toContain("Foo.constructor");
    expect(names).toContain("Foo.bar");
  });

  it("includes getter as property kind", () => {
    const source = `
      export class Foo {
        get session(): string { return ""; }
      }
    `;
    const symbols = extractFromSource(source, "src/index.ts");
    const s = symbols.find((x) => x.name === "Foo.session");
    expect(s).toBeDefined();
    expect(s?.kind).toBe("method");
  });
});

describe("parseTypeScriptProject (fixture)", () => {
  it("parses the fixture project and finds expected symbols", () => {
    const result = parseTypeScriptProject(FIXTURE);
    const names = result.symbols.map((s) => s.name);

    expect(names).toContain("AuthClient");
    expect(names).toContain("AuthClient.signUp");
    expect(names).toContain("AuthClient.signIn");
    expect(names).toContain("AuthClient.session");
    expect(names).toContain("StorageClient");
    expect(names).toContain("StorageClient.upload");
    expect(names).toContain("createClient");
    expect(names).toContain("version");
  });

  it("excludes private and internal symbols from fixture", () => {
    const result = parseTypeScriptProject(FIXTURE);
    const names = result.symbols.map((s) => s.name);

    expect(names).not.toContain("AuthClient._token");
    expect(names).not.toContain("AuthClient._refresh");
    expect(names).not.toContain("InternalHelper");
    expect(names).not.toContain("internalUtil");
  });
});
