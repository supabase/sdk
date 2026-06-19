import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeFileSync, mkdirSync } from "node:fs";
import { extractFromSource, parsePythonProject } from "../src/python-parser";

function names(src: string): string[] {
  return extractFromSource(src, "supabase/client.py").map((s) => s.name);
}

function kinds(src: string): Record<string, string> {
  return Object.fromEntries(
    extractFromSource(src, "supabase/client.py").map((s) => [s.name, s.kind]),
  );
}

// ---------------------------------------------------------------------------
// Type declarations
// ---------------------------------------------------------------------------

describe("extractFromSource — class declarations", () => {
  it("extracts a public class", () => {
    expect(names("class AuthClient:\n    pass\n")).toContain("AuthClient");
  });

  it("extracts a class with a base class", () => {
    expect(names("class AuthClient(BaseClient):\n    pass\n")).toContain("AuthClient");
  });

  it("does not extract a private class (leading underscore)", () => {
    expect(names("class _Internal:\n    pass\n")).not.toContain("_Internal");
  });

  it("extracts an abstract base class", () => {
    expect(names("class BaseAuth(ABC):\n    pass\n")).toContain("BaseAuth");
  });
});

// ---------------------------------------------------------------------------
// Public methods
// ---------------------------------------------------------------------------

describe("extractFromSource — public methods", () => {
  const src = `
class AuthClient:
    def sign_up(self, email: str, password: str) -> dict:
        pass

    async def sign_in(self, credentials: dict) -> dict:
        pass

    def sign_out(self) -> None:
        pass
`;
  it("extracts a regular method", () => expect(names(src)).toContain("AuthClient.sign_up"));
  it("extracts an async method", () => expect(names(src)).toContain("AuthClient.sign_in"));
  it("extracts multiple methods", () => expect(names(src)).toContain("AuthClient.sign_out"));
  it("marks methods with kind 'method'", () => {
    expect(kinds(src)["AuthClient.sign_up"]).toBe("method");
  });
});

// ---------------------------------------------------------------------------
// Private / dunder exclusions
// ---------------------------------------------------------------------------

describe("extractFromSource — private and dunder exclusions", () => {
  const src = `
class SupabaseClient:
    def __init__(self, url: str, key: str):
        pass

    def __repr__(self) -> str:
        pass

    def _connect(self):
        pass

    def public_method(self):
        pass
`;
  it("excludes __init__", () => expect(names(src)).not.toContain("SupabaseClient.__init__"));
  it("excludes __repr__", () => expect(names(src)).not.toContain("SupabaseClient.__repr__"));
  it("excludes private methods (leading _)", () => expect(names(src)).not.toContain("SupabaseClient._connect"));
  it("includes the public method", () => expect(names(src)).toContain("SupabaseClient.public_method"));
});

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe("extractFromSource — properties", () => {
  const src = `
class SupabaseClient:
    @property
    def auth(self):
        return self._auth

    @auth.setter
    def auth(self, value):
        self._auth = value

    @property
    def storage(self):
        return self._storage
`;
  it("extracts @property getter", () => expect(names(src)).toContain("SupabaseClient.auth"));
  it("marks @property with kind 'property'", () => {
    expect(kinds(src)["SupabaseClient.auth"]).toBe("property");
  });
  it("extracts second @property", () => expect(names(src)).toContain("SupabaseClient.storage"));
  it("does not emit duplicate from @auth.setter", () => {
    const authEntries = names(src).filter((n) => n === "SupabaseClient.auth");
    expect(authEntries).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Static and class methods
// ---------------------------------------------------------------------------

describe("extractFromSource — static and class methods", () => {
  const src = `
class FunctionsClient:
    @staticmethod
    def create(url: str) -> "FunctionsClient":
        pass

    @classmethod
    def from_env(cls) -> "FunctionsClient":
        pass
`;
  it("extracts @staticmethod", () => expect(names(src)).toContain("FunctionsClient.create"));
  it("marks @staticmethod as kind 'method'", () => {
    expect(kinds(src)["FunctionsClient.create"]).toBe("method");
  });
  it("extracts @classmethod", () => expect(names(src)).toContain("FunctionsClient.from_env"));
});

// ---------------------------------------------------------------------------
// Top-level functions
// ---------------------------------------------------------------------------

describe("extractFromSource — top-level functions", () => {
  it("extracts a top-level function", () => {
    expect(names("def create_client(url: str, key: str):\n    pass\n")).toContain("create_client");
  });

  it("marks top-level functions with kind 'function'", () => {
    expect(kinds("def create_client(url: str):\n    pass\n")["create_client"]).toBe("function");
  });

  it("does not extract private top-level functions", () => {
    expect(names("def _internal_helper():\n    pass\n")).not.toContain("_internal_helper");
  });

  it("extracts an async top-level function", () => {
    expect(names("async def fetch(url: str):\n    pass\n")).toContain("fetch");
  });
});

// ---------------------------------------------------------------------------
// Nested classes
// ---------------------------------------------------------------------------

describe("extractFromSource — nested classes", () => {
  const src = `
class SupabaseClient:
    class Config:
        def get(self, key: str) -> str:
            pass

    def from_(self, table: str):
        pass
`;
  it("extracts the outer class", () => expect(names(src)).toContain("SupabaseClient"));
  it("extracts the nested class with dotted name", () => expect(names(src)).toContain("SupabaseClient.Config"));
  it("extracts a method of the nested class", () => expect(names(src)).toContain("SupabaseClient.Config.get"));
  it("extracts a method of the outer class after the nested class", () => expect(names(src)).toContain("SupabaseClient.from_"));
});

// ---------------------------------------------------------------------------
// Methods inside method bodies must not leak
// ---------------------------------------------------------------------------

describe("extractFromSource — method body isolation", () => {
  const src = `
class Foo:
    def outer(self):
        def inner_helper():
            pass
        return inner_helper

    def real_method(self):
        pass
`;
  it("does not capture nested function defined inside a method body", () => {
    expect(names(src)).not.toContain("Foo.inner_helper");
  });
  it("still captures the real method after the containing method", () => {
    expect(names(src)).toContain("Foo.real_method");
  });
});

// ---------------------------------------------------------------------------
// Comment stripping
// ---------------------------------------------------------------------------

describe("extractFromSource — comment stripping", () => {
  it("ignores class definitions in inline comments", () => {
    const src = `
class Foo:
    def real(self): pass  # def fake(self): pass
`;
    expect(names(src)).toContain("Foo.real");
    expect(names(src)).not.toContain("Foo.fake");
  });

  it("ignores full-line comments", () => {
    const src = `
class Foo:
    # def commented_out(self): pass
    def real(self): pass
`;
    expect(names(src)).toContain("Foo.real");
    expect(names(src)).not.toContain("Foo.commented_out");
  });
});

// ---------------------------------------------------------------------------
// Context stack correctness
// ---------------------------------------------------------------------------

describe("extractFromSource — context stack correctness", () => {
  it("does not bleed members across sibling classes", () => {
    const src = `
class Auth:
    def sign_up(self): pass

class Storage:
    def upload(self): pass
`;
    const n = names(src);
    expect(n).toContain("Auth.sign_up");
    expect(n).toContain("Storage.upload");
    expect(n).not.toContain("Auth.upload");
    expect(n).not.toContain("Storage.sign_up");
  });
});

// ---------------------------------------------------------------------------
// Integration test against fixture project
// ---------------------------------------------------------------------------

describe("parsePythonProject — fixture project", () => {
  const fixtureDir = join(__dirname, "fixtures", "python-sample");

  it("finds and parses all public symbols", () => {
    const result = parsePythonProject(fixtureDir);
    const symbolNames = result.symbols.map((s) => s.name);

    // Public classes
    expect(symbolNames).toContain("SupabaseClient");
    expect(symbolNames).toContain("StorageClient");

    // Public methods / properties
    expect(symbolNames).toContain("SupabaseClient.auth");
    expect(symbolNames).toContain("SupabaseClient.storage");
    expect(symbolNames).toContain("SupabaseClient.rpc");
    expect(symbolNames).toContain("SupabaseClient.from_");
    expect(symbolNames).toContain("SupabaseClient.create");
    expect(symbolNames).toContain("SupabaseClient.from_url");
    expect(symbolNames).toContain("StorageClient.upload");
    expect(symbolNames).toContain("StorageClient.download");

    // Top-level function
    expect(symbolNames).toContain("create_client");

    // Private things must be absent
    expect(symbolNames).not.toContain("_InternalCache");
    expect(symbolNames).not.toContain("_private_function");
    expect(symbolNames).not.toContain("SupabaseClient.__init__");
    expect(symbolNames).not.toContain("SupabaseClient.__repr__");
    expect(symbolNames).not.toContain("SupabaseClient._private_helper");

    // Setter must not duplicate the property
    const authEntries = symbolNames.filter((n) => n === "SupabaseClient.auth");
    expect(authEntries).toHaveLength(1);
  });

  it("marks properties correctly from fixture", () => {
    const result = parsePythonProject(fixtureDir);
    const prop = result.symbols.find((s) => s.name === "SupabaseClient.auth");
    expect(prop?.kind).toBe("property");
  });
});

// ---------------------------------------------------------------------------
// sdk-parse-ignore support
// ---------------------------------------------------------------------------

describe("parsePythonProject — sdk-parse-ignore", () => {
  it("excludes files matched by sdk-parse-ignore", () => {
    const dir = join(tmpdir(), `python-parser-ignore-test-${process.pid}`);
    const pkgDir = join(dir, "supabase");
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(join(pkgDir, "client.py"), "class SupabaseClient:\n    def sign_up(self): pass\n");
    writeFileSync(join(dir, "sdk-parse-ignore"), "supabase/client.py\n");
    const result = parsePythonProject(dir);
    expect(result.symbols.map((s) => s.name)).not.toContain("SupabaseClient");
  });

  it("excludes entire directories matched by sdk-parse-ignore", () => {
    const dir = join(tmpdir(), `python-parser-dir-ignore-test-${process.pid}`);
    const testDir = join(dir, "tests");
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(dir, "client.py"), "class SupabaseClient:\n    pass\n");
    writeFileSync(join(testDir, "test_client.py"), "class TestClient:\n    pass\n");
    writeFileSync(join(dir, "sdk-parse-ignore"), "tests/\n");
    const result = parsePythonProject(dir);
    const n = result.symbols.map((s) => s.name);
    expect(n).toContain("SupabaseClient");
    expect(n).not.toContain("TestClient");
  });

  it("does not filter when sdk-parse-ignore is absent", () => {
    const dir = join(tmpdir(), `python-parser-no-ignore-test-${process.pid}`);
    const pkgDir = join(dir, "supabase");
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(join(pkgDir, "client.py"), "class SupabaseClient:\n    pass\n");
    const result = parsePythonProject(dir);
    expect(result.symbols.map((s) => s.name)).toContain("SupabaseClient");
  });
});
