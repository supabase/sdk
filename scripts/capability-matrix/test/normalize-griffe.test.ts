import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeFileSync, mkdtempSync } from "node:fs";
import { normalizeGriffe, type GriffeOutput, type GriffeNode } from "../src/normalize-griffe";

// Helper: build a minimal module node wrapping members
function pkg(filepath: string, members: Record<string, GriffeNode>): GriffeOutput {
  return { mypkg: { kind: "module", filepath, members } };
}

describe("normalizeGriffe — classes", () => {
  it("emits public class", () => {
    const input = pkg("/repo/src/client.py", {
      MyClient: { kind: "class", members: {} },
    });
    const { symbols } = normalizeGriffe(input, "/repo");
    expect(symbols).toContainEqual({ name: "MyClient", kind: "class", file: "src/client.py" });
  });

  it("skips class whose name starts with underscore", () => {
    const input = pkg("/repo/src/client.py", {
      _Internal: { kind: "class", members: {} },
    });
    const { symbols } = normalizeGriffe(input, "/repo");
    expect(symbols).toHaveLength(0);
  });

  it("skips methods inside a private class", () => {
    const input = pkg("/repo/src/client.py", {
      _Internal: {
        kind: "class",
        members: { public_method: { kind: "function", labels: null } },
      },
    });
    const { symbols } = normalizeGriffe(input, "/repo");
    expect(symbols).toHaveLength(0);
  });
});

describe("normalizeGriffe — methods and functions", () => {
  it("emits public method as ClassName.method_name", () => {
    const input = pkg("/repo/src/client.py", {
      MyClient: {
        kind: "class",
        members: { sign_up: { kind: "function", labels: null } },
      },
    });
    const { symbols } = normalizeGriffe(input, "/repo");
    expect(symbols).toContainEqual({ name: "MyClient.sign_up", kind: "method", file: "src/client.py" });
  });

  it("skips method whose name starts with underscore", () => {
    const input = pkg("/repo/src/client.py", {
      MyClient: {
        kind: "class",
        members: { _private: { kind: "function", labels: null } },
      },
    });
    const { symbols } = normalizeGriffe(input, "/repo");
    // only the class itself is emitted, not the private method
    expect(symbols).toHaveLength(1);
    expect(symbols[0].name).toBe("MyClient");
  });

  it("emits top-level function as function kind", () => {
    const input = pkg("/repo/src/client.py", {
      create_client: { kind: "function", labels: null },
    });
    const { symbols } = normalizeGriffe(input, "/repo");
    expect(symbols).toContainEqual({ name: "create_client", kind: "function", file: "src/client.py" });
  });

  it("skips top-level function whose name starts with underscore", () => {
    const input = pkg("/repo/src/client.py", {
      _helper: { kind: "function", labels: null },
    });
    const { symbols } = normalizeGriffe(input, "/repo");
    expect(symbols).toHaveLength(0);
  });

  it("emits staticmethod member as method (label is informational only)", () => {
    const input = pkg("/repo/src/client.py", {
      MyClient: {
        kind: "class",
        members: { from_env: { kind: "function", labels: ["staticmethod"] } },
      },
    });
    const { symbols } = normalizeGriffe(input, "/repo");
    expect(symbols).toContainEqual({ name: "MyClient.from_env", kind: "method", file: "src/client.py" });
  });

  it("emits classmethod member as method", () => {
    const input = pkg("/repo/src/client.py", {
      MyClient: {
        kind: "class",
        members: { from_url: { kind: "function", labels: ["classmethod"] } },
      },
    });
    const { symbols } = normalizeGriffe(input, "/repo");
    expect(symbols).toContainEqual({ name: "MyClient.from_url", kind: "method", file: "src/client.py" });
  });

  it("skips dunder method (__init__)", () => {
    const input = pkg("/repo/src/client.py", {
      MyClient: {
        kind: "class",
        members: { __init__: { kind: "function", labels: null } },
      },
    });
    const { symbols } = normalizeGriffe(input, "/repo");
    expect(symbols.find((s) => s.name.includes("__init__"))).toBeUndefined();
  });
});

describe("normalizeGriffe — properties", () => {
  it("emits attribute with property label as property kind", () => {
    const input = pkg("/repo/src/client.py", {
      MyClient: {
        kind: "class",
        members: { session: { kind: "attribute", labels: ["property", "writable"] } },
      },
    });
    const { symbols } = normalizeGriffe(input, "/repo");
    expect(symbols).toContainEqual({ name: "MyClient.session", kind: "property", file: "src/client.py" });
  });

  it("does not emit attribute without property label (plain class variable)", () => {
    const input = pkg("/repo/src/client.py", {
      MyClient: {
        kind: "class",
        members: { DEFAULT_URL: { kind: "attribute", labels: null } },
      },
    });
    const { symbols } = normalizeGriffe(input, "/repo");
    // only the class itself
    expect(symbols.find((s) => s.name === "MyClient.DEFAULT_URL")).toBeUndefined();
  });

  it("handles labels: [] (empty array) — not a property", () => {
    const input = pkg("/repo/src/client.py", {
      MyClient: {
        kind: "class",
        members: { TOKEN: { kind: "attribute", labels: [] } },
      },
    });
    const { symbols } = normalizeGriffe(input, "/repo");
    expect(symbols.find((s) => s.name === "MyClient.TOKEN")).toBeUndefined();
  });

  it("skips property whose name starts with underscore", () => {
    const input = pkg("/repo/src/client.py", {
      MyClient: {
        kind: "class",
        members: { _session: { kind: "attribute", labels: ["property"] } },
      },
    });
    const { symbols } = normalizeGriffe(input, "/repo");
    expect(symbols.find((s) => s.name.includes("_session"))).toBeUndefined();
  });
});

describe("normalizeGriffe — sub-modules", () => {
  it("recurses into private-named sub-module (_async) and emits public classes inside", () => {
    const input: GriffeOutput = {
      supabase_auth: {
        kind: "module",
        filepath: "/repo/src/supabase_auth/__init__.py",
        members: {
          _async: {
            kind: "module",
            filepath: "/repo/src/supabase_auth/_async/__init__.py",
            members: {
              AsyncGoTrueClient: {
                kind: "class",
                members: {
                  sign_up: { kind: "function", labels: null },
                },
              },
            },
          },
        },
      },
    };
    const { symbols } = normalizeGriffe(input, "/repo");
    expect(symbols).toContainEqual({ name: "AsyncGoTrueClient", kind: "class", file: "src/supabase_auth/_async/__init__.py" });
    expect(symbols).toContainEqual({ name: "AsyncGoTrueClient.sign_up", kind: "method", file: "src/supabase_auth/_async/__init__.py" });
  });
});

describe("normalizeGriffe — nested classes", () => {
  it("emits nested class as Outer.Inner", () => {
    const input = pkg("/repo/src/client.py", {
      Outer: {
        kind: "class",
        members: {
          Inner: { kind: "class", members: {} },
        },
      },
    });
    const { symbols } = normalizeGriffe(input, "/repo");
    expect(symbols).toContainEqual({ name: "Outer.Inner", kind: "class", file: "src/client.py" });
  });

  it("emits method of nested class as Outer.Inner.method", () => {
    const input = pkg("/repo/src/client.py", {
      Outer: {
        kind: "class",
        members: {
          Inner: {
            kind: "class",
            members: { do_thing: { kind: "function", labels: null } },
          },
        },
      },
    });
    const { symbols } = normalizeGriffe(input, "/repo");
    expect(symbols).toContainEqual({ name: "Outer.Inner.do_thing", kind: "method", file: "src/client.py" });
  });
});

describe("normalizeGriffe — multi-package input", () => {
  it("emits symbols from all packages in output", () => {
    const input: GriffeOutput = {
      pkg_a: {
        kind: "module",
        filepath: "/repo/src/pkg_a/__init__.py",
        members: { ClassA: { kind: "class", members: {} } },
      },
      pkg_b: {
        kind: "module",
        filepath: "/repo/src/pkg_b/__init__.py",
        members: { ClassB: { kind: "class", members: {} } },
      },
    };
    const { symbols } = normalizeGriffe(input, "/repo");
    expect(symbols.map((s) => s.name)).toContain("ClassA");
    expect(symbols.map((s) => s.name)).toContain("ClassB");
  });
});

describe("normalizeGriffe — file inheritance", () => {
  it("inherits filepath from parent module when member has no filepath", () => {
    const input: GriffeOutput = {
      mypkg: {
        kind: "module",
        filepath: "/repo/src/mypkg/client.py",
        members: {
          // class has no own filepath — should inherit module's
          MyClient: { kind: "class", members: {} },
        },
      },
    };
    const { symbols } = normalizeGriffe(input, "/repo");
    expect(symbols[0].file).toBe("src/mypkg/client.py");
  });
});

describe("normalizeGriffe — sdk-parse-ignore", () => {
  it("filters out symbols whose file matches sdk-parse-ignore", () => {
    const root = mkdtempSync(join(tmpdir(), "griffe-test-"));
    writeFileSync(join(root, "sdk-parse-ignore"), "tests/\n");

    const input: GriffeOutput = {
      mypkg: {
        kind: "module",
        filepath: join(root, "src/tests/test_client.py"),
        members: {
          TestHelper: { kind: "class", members: {} },
        },
      },
    };
    const { symbols } = normalizeGriffe(input, root);
    expect(symbols).toHaveLength(0);
  });

  it("does not filter symbols whose file does not match sdk-parse-ignore", () => {
    const root = mkdtempSync(join(tmpdir(), "griffe-test-"));
    writeFileSync(join(root, "sdk-parse-ignore"), "src/tests/\n");

    const input: GriffeOutput = {
      mypkg: {
        kind: "module",
        filepath: join(root, "src/mypkg/client.py"),
        members: {
          MyClient: { kind: "class", members: {} },
        },
      },
    };
    const { symbols } = normalizeGriffe(input, root);
    expect(symbols).toHaveLength(1);
  });

  it("works with no sdk-parse-ignore file present", () => {
    const root = mkdtempSync(join(tmpdir(), "griffe-test-no-ignore-"));
    // no sdk-parse-ignore file written

    const input = pkg(join(root, "src/client.py"), {
      MyClient: { kind: "class", members: {} },
    });
    const { symbols } = normalizeGriffe(input, root);
    expect(symbols).toHaveLength(1);
  });
});
