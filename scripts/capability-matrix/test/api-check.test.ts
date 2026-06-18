import { describe, it, expect } from "vitest";
import { checkNewSymbols, formatErrorMessage, formatRemovedMessage } from "../src/api-check";
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

describe("checkNewSymbols — removed registered symbols", () => {
  it("returns empty removedRegisteredSymbols when nothing is removed", () => {
    const base = [sym("AuthClient.signIn")];
    const pr = [sym("AuthClient.signIn"), sym("AuthClient.signUp")];
    const result = checkNewSymbols(base, pr, compliance);
    expect(result.removedRegisteredSymbols).toHaveLength(0);
  });

  it("detects a removed symbol that is registered in compliance", () => {
    const base = [sym("AuthClient.signIn"), sym("AuthClient.signUp")];
    const pr = [sym("AuthClient.signIn")];
    const result = checkNewSymbols(base, pr, compliance);
    expect(result.removedRegisteredSymbols).toEqual([
      { symbol: "AuthClient.signUp", featureId: "auth.sign_up" },
    ]);
  });

  it("ignores removed symbols that are not registered in compliance", () => {
    const base = [sym("AuthClient.signIn"), sym("AuthClient.internalHelper")];
    const pr = [sym("AuthClient.signIn")];
    const result = checkNewSymbols(base, pr, compliance);
    expect(result.removedRegisteredSymbols).toHaveLength(0);
  });

  it("reports multiple removed registered symbols", () => {
    const base = [sym("AuthClient.signIn"), sym("AuthClient.signUp")];
    const pr: ParsedSymbol[] = [];
    const result = checkNewSymbols(base, pr, compliance);
    expect(result.removedRegisteredSymbols).toHaveLength(2);
    const symbols = result.removedRegisteredSymbols.map((r) => r.symbol);
    expect(symbols).toContain("AuthClient.signIn");
    expect(symbols).toContain("AuthClient.signUp");
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

describe("formatRemovedMessage", () => {
  it("includes removed symbol and feature ID in output", () => {
    const msg = formatRemovedMessage(
      [{ symbol: "AuthClient.signUp", featureId: "auth.sign_up" }],
      "swift",
    );
    expect(msg).toContain("❌ Capability matrix check failed");
    expect(msg).toContain("AuthClient.signUp (swift) → auth.sign_up");
    expect(msg).toContain("sdk-compliance.yaml");
  });

  it("includes multiple removed symbols", () => {
    const msg = formatRemovedMessage(
      [
        { symbol: "AuthClient.signUp", featureId: "auth.sign_up" },
        { symbol: "AuthClient.signIn", featureId: "auth.sign_in" },
      ],
      "swift",
    );
    expect(msg).toContain("AuthClient.signUp (swift) → auth.sign_up");
    expect(msg).toContain("AuthClient.signIn (swift) → auth.sign_in");
  });
});
