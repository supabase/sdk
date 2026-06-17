import { describe, it, expect } from "vitest";
import { checkNewSymbols, formatErrorMessage } from "../src/api-check";
import type { ParsedSymbol } from "../src/ts-parser";

function sym(name: string): ParsedSymbol {
  return { name, kind: "method", file: "src/index.ts" };
}

const compliance = {
  sdk: "javascript",
  features: {
    "auth.sign_up": {
      status: "implemented",
      symbols: ["AuthClient.signUp"],
    },
    "auth.sign_in": {
      status: "implemented",
      symbols: ["AuthClient.signIn"],
    },
  },
};

describe("checkNewSymbols", () => {
  it("returns empty uncovered when all new symbols are in compliance", () => {
    const base = [sym("AuthClient.signIn")];
    const pr = [sym("AuthClient.signIn"), sym("AuthClient.signUp")];
    const result = checkNewSymbols(base, pr, compliance);
    expect(result.newSymbols).toEqual(["AuthClient.signUp"]);
    expect(result.uncoveredSymbols).toEqual([]);
  });

  it("reports uncovered symbols not in compliance", () => {
    const base: ParsedSymbol[] = [];
    const pr = [sym("AuthClient.signInWithPasskey")];
    const result = checkNewSymbols(base, pr, compliance);
    expect(result.newSymbols).toEqual(["AuthClient.signInWithPasskey"]);
    expect(result.uncoveredSymbols).toEqual(["AuthClient.signInWithPasskey"]);
  });

  it("ignores symbols that exist in both base and PR", () => {
    const base = [sym("AuthClient.signUp"), sym("AuthClient.signIn")];
    const pr = [sym("AuthClient.signUp"), sym("AuthClient.signIn")];
    const result = checkNewSymbols(base, pr, compliance);
    expect(result.newSymbols).toHaveLength(0);
    expect(result.uncoveredSymbols).toHaveLength(0);
  });

  it("treats empty base as all PR symbols being new", () => {
    const base: ParsedSymbol[] = [];
    const pr = [sym("AuthClient.signUp"), sym("AuthClient.signIn")];
    const result = checkNewSymbols(base, pr, compliance);
    expect(result.newSymbols).toHaveLength(2);
    expect(result.uncoveredSymbols).toHaveLength(0);
  });

  it("reports multiple uncovered symbols", () => {
    const base: ParsedSymbol[] = [];
    const pr = [sym("AuthClient.foo"), sym("AuthClient.bar")];
    const result = checkNewSymbols(base, pr, compliance);
    expect(result.uncoveredSymbols).toEqual(["AuthClient.foo", "AuthClient.bar"]);
  });
});

describe("formatErrorMessage", () => {
  it("includes all uncovered symbols in output", () => {
    const msg = formatErrorMessage(["AuthClient.signInWithPasskey"], "javascript");
    expect(msg).toContain("❌ Capability matrix check failed");
    expect(msg).toContain("AuthClient.signInWithPasskey (javascript)");
    expect(msg).toContain("sdk-compliance.yaml");
  });

  it("includes multiple uncovered symbols", () => {
    const msg = formatErrorMessage(["Foo.a", "Foo.b"], "flutter");
    expect(msg).toContain("Foo.a (flutter)");
    expect(msg).toContain("Foo.b (flutter)");
  });
});
