import { describe, it, expect } from "vitest";
import { validateCompliance, normalizeCompliance, collectFeatureIds, buildSymbolIndex, findMissingFeatureIds, TOP_LEVEL_SUPPORTING } from "../src/compliance";
import { checkDrift } from "../src/drift-check";
import { checkNewSymbols } from "../src/api-check";
import type { ParsedSymbol } from "../src/normalize-typedoc";
import type { LoadedArea } from "../src/types";

function areas(ids: string[]): LoadedArea[] {
  return [
    {
      file: "auth.yaml",
      area: {
        area: "auth",
        title: "Auth",
        description: "d",
        features: ids.map((id) => ({ id, name: id, description: "d" })),
      },
    },
  ];
}

function sym(name: string): ParsedSymbol {
  return { name, kind: "method", file: "src/index.ts" };
}

const knownIds = new Set(["auth.sign_up", "auth.sign_in_with_password", "auth.mfa_enroll"]);

describe("validateCompliance", () => {
  it("passes a valid sparse file with scalar statuses", () => {
    const raw = {
      sdk: "javascript",
      features: {
        "auth.sign_up": "implemented",
        "auth.sign_in_with_password": "not_implemented",
      },
    };
    expect(validateCompliance(raw, knownIds)).toEqual([]);
  });

  it("passes a map-form entry with a note", () => {
    const raw = {
      sdk: "javascript",
      features: {
        "auth.mfa_enroll": { status: "partially_implemented", note: "TOTP only" },
      },
    };
    expect(validateCompliance(raw, knownIds)).toEqual([]);
  });

  it("allows note on any status", () => {
    const raw = {
      sdk: "javascript",
      features: {
        "auth.sign_up": { status: "not_implemented", note: "Blocked on platform support" },
      },
    };
    expect(validateCompliance(raw, knownIds)).toEqual([]);
  });

  it("errors on unknown sdk", () => {
    const raw = { sdk: "ruby", features: {} };
    const findings = validateCompliance(raw, knownIds);
    expect(findings.some((f) => f.message.includes('unknown sdk "ruby"'))).toBe(true);
  });

  it("errors on unknown feature id", () => {
    const raw = { sdk: "javascript", features: { "auth.nonexistent": "implemented" } };
    const findings = validateCompliance(raw, knownIds);
    expect(findings.some((f) => f.message.includes('unknown feature id "auth.nonexistent"'))).toBe(true);
  });

  it("errors on unknown status value", () => {
    const raw = { sdk: "javascript", features: { "auth.sign_up": "done" } };
    const findings = validateCompliance(raw, knownIds);
    expect(findings.some((f) => f.message.includes('unknown status "done"'))).toBe(true);
  });

  it("errors when partially_implemented has no note", () => {
    const raw = {
      sdk: "javascript",
      features: { "auth.mfa_enroll": { status: "partially_implemented" } },
    };
    const findings = validateCompliance(raw, knownIds);
    expect(findings.some((f) => f.message.includes("requires a note"))).toBe(true);
  });
});

describe("normalizeCompliance", () => {
  it("converts scalar statuses to ComplianceEntry objects", () => {
    const raw = {
      sdk: "javascript",
      features: { "auth.sign_up": "implemented" },
    };
    const map = normalizeCompliance(raw);
    expect(map["auth.sign_up"]).toEqual({ status: "implemented" });
  });

  it("preserves note from map-form entries", () => {
    const raw = {
      sdk: "javascript",
      features: { "auth.mfa_enroll": { status: "partially_implemented", note: "TOTP only" } },
    };
    const map = normalizeCompliance(raw);
    expect(map["auth.mfa_enroll"]).toEqual({ status: "partially_implemented", note: "TOTP only" });
  });
});

describe("symbols field", () => {
  it("accepts an entry with a symbols array", () => {
    const raw = {
      sdk: "javascript",
      features: {
        "auth.sign_up": { status: "implemented", symbols: ["GoTrueClient.signUp"] },
      },
    };
    expect(validateCompliance(raw, knownIds)).toEqual([]);
  });

  it("errors when symbols is not an array", () => {
    const raw = {
      sdk: "javascript",
      features: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "auth.sign_up": { status: "implemented", symbols: "GoTrueClient.signUp" } as any,
      },
    };
    const findings = validateCompliance(raw, knownIds);
    expect(findings.some((f) => f.message.includes("symbols must be an array"))).toBe(true);
  });

  it("errors when symbols contains non-strings", () => {
    const raw = {
      sdk: "javascript",
      features: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "auth.sign_up": { status: "implemented", symbols: [42] } as any,
      },
    };
    const findings = validateCompliance(raw, knownIds);
    expect(findings.some((f) => f.message.includes("symbols must be an array of strings"))).toBe(true);
  });

  it("normalizeCompliance preserves symbols", () => {
    const raw = {
      sdk: "javascript",
      features: {
        "auth.sign_up": { status: "implemented", symbols: ["GoTrueClient.signUp"] },
      },
    };
    const map = normalizeCompliance(raw);
    expect(map["auth.sign_up"].symbols).toEqual(["GoTrueClient.signUp"]);
  });
});

describe("supporting_symbols field", () => {
  it("accepts per-feature and top-level supporting_symbols", () => {
    const raw = {
      sdk: "javascript",
      features: {
        "auth.sign_up": {
          status: "implemented",
          symbols: ["GoTrueClient.signUp"],
          supporting_symbols: ["SignUpOptions", "SignUpOptions.redirectTo"],
        },
      },
      supporting_symbols: ["AuthException"],
    };
    expect(validateCompliance(raw, knownIds)).toEqual([]);
  });

  it("errors when per-feature supporting_symbols is not an array of strings", () => {
    const raw = {
      sdk: "javascript",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      features: { "auth.sign_up": { status: "implemented", supporting_symbols: [42] } as any },
    };
    const findings = validateCompliance(raw, knownIds);
    expect(
      findings.some((f) => f.message === '"auth.sign_up": supporting_symbols must be an array of strings')
    ).toBe(true);
  });

  it("errors when top-level supporting_symbols is not an array of strings", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = { sdk: "javascript", features: {}, supporting_symbols: "AuthException" } as any;
    const findings = validateCompliance(raw, knownIds);
    expect(
      findings.some((f) => f.message === "top level: supporting_symbols must be an array of strings")
    ).toBe(true);
  });

  it("normalizeCompliance preserves supporting_symbols", () => {
    const raw = {
      sdk: "javascript",
      features: {
        "auth.sign_up": { status: "implemented", supporting_symbols: ["SignUpOptions"] },
      },
    };
    expect(normalizeCompliance(raw)["auth.sign_up"].supporting_symbols).toEqual(["SignUpOptions"]);
  });

  it("omits supporting_symbols from the normalized entry when absent", () => {
    const raw = {
      sdk: "javascript",
      features: { "auth.sign_up": { status: "implemented", symbols: ["GoTrueClient.signUp"] } },
    };
    expect(normalizeCompliance(raw)["auth.sign_up"]).toEqual({
      status: "implemented",
      symbols: ["GoTrueClient.signUp"],
    });
  });

  it("is not treated as implementation evidence by the drift check", () => {
    const compliance = {
      sdk: "javascript",
      features: {
        "auth.sign_up": {
          status: "implemented",
          symbols: ["GoTrueClient.signUp"],
          supporting_symbols: ["SignUpOptions"],
        },
      },
    };
    // Only the entry point exists in the parsed API; the supporting type is gone.
    const findings = checkDrift([sym("GoTrueClient.signUp")], compliance);
    expect(findings).toEqual([]);
  });

  it("does not let supporting_symbols alone satisfy the drift check", () => {
    const compliance = {
      sdk: "javascript",
      features: {
        "auth.sign_up": { status: "implemented", supporting_symbols: ["SignUpOptions"] },
      },
    };
    const findings = checkDrift([sym("SignUpOptions")], compliance);
    expect(findings).toEqual([{ featureId: "auth.sign_up" }]);
  });

  it("counts toward new-symbol coverage", () => {
    const compliance = {
      sdk: "javascript",
      features: {
        "auth.sign_up": {
          status: "implemented",
          symbols: ["GoTrueClient.signUp"],
          supporting_symbols: ["SignUpOptions"],
        },
      },
      supporting_symbols: ["AuthException"],
    };
    const result = checkNewSymbols(
      [],
      [sym("SignUpOptions"), sym("AuthException"), sym("Unregistered")],
      compliance
    );
    expect(result.uncoveredSymbols.map((s) => s.name)).toEqual(["Unregistered"]);
  });
});

describe("buildSymbolIndex", () => {
  it("builds a symbol → feature-id map", () => {
    const raw = {
      sdk: "javascript",
      features: {
        "auth.sign_up": { status: "implemented", symbols: ["GoTrueClient.signUp"] },
        "auth.sign_in_with_password": {
          status: "implemented",
          symbols: ["GoTrueClient.signInWithPassword"],
        },
      },
    };
    const index = buildSymbolIndex(raw);
    expect(index.get("GoTrueClient.signUp")).toBe("auth.sign_up");
    expect(index.get("GoTrueClient.signInWithPassword")).toBe("auth.sign_in_with_password");
  });

  it("returns empty map when no symbols are declared", () => {
    const raw = { sdk: "javascript", features: { "auth.sign_up": "implemented" } };
    const index = buildSymbolIndex(raw);
    expect(index.size).toBe(0);
  });

  it("indexes supporting symbols against their feature", () => {
    const raw = {
      sdk: "javascript",
      features: {
        "auth.sign_up": { status: "implemented", supporting_symbols: ["SignUpOptions"] },
      },
    };
    expect(buildSymbolIndex(raw).get("SignUpOptions")).toBe("auth.sign_up");
  });

  it("indexes top-level supporting symbols against the pseudo feature id", () => {
    const raw = { sdk: "javascript", features: {}, supporting_symbols: ["AuthException"] };
    expect(buildSymbolIndex(raw).get("AuthException")).toBe(TOP_LEVEL_SUPPORTING);
  });

  it("attributes a symbol to the capability that implements it over any supporting list", () => {
    const raw = {
      sdk: "javascript",
      features: {
        "auth.sign_up": { status: "implemented", symbols: ["GoTrueClient.signUp"] },
        "auth.mfa_enroll": {
          status: "implemented",
          supporting_symbols: ["GoTrueClient.signUp"],
        },
      },
      supporting_symbols: ["GoTrueClient.signUp"],
    };
    expect(buildSymbolIndex(raw).get("GoTrueClient.signUp")).toBe("auth.sign_up");
  });
});

describe("findMissingFeatureIds", () => {
  it("returns ids present in knownIds but absent from raw.features", () => {
    const raw = { sdk: "javascript", features: { "auth.sign_up": "implemented" } };
    const missing = findMissingFeatureIds(raw, knownIds);
    expect(missing).toContain("auth.sign_in_with_password");
    expect(missing).toContain("auth.mfa_enroll");
    expect(missing).not.toContain("auth.sign_up");
  });

  it("returns empty array when all known ids are declared", () => {
    const raw = {
      sdk: "javascript",
      features: {
        "auth.sign_up": "implemented",
        "auth.sign_in_with_password": "implemented",
        "auth.mfa_enroll": "not_implemented",
      },
    };
    expect(findMissingFeatureIds(raw, knownIds)).toEqual([]);
  });

  it("returns all ids when features is empty", () => {
    const raw = { sdk: "javascript", features: {} };
    const missing = findMissingFeatureIds(raw, knownIds);
    expect(missing).toEqual([...knownIds].sort());
  });

  it("returns ids in sorted order", () => {
    const raw = { sdk: "javascript", features: {} };
    const missing = findMissingFeatureIds(raw, knownIds);
    expect(missing).toEqual([...missing].sort());
  });
});

describe("collectFeatureIds", () => {
  it("collects all feature ids from loaded areas", () => {
    const loaded = areas(["auth.sign_up", "auth.sign_in_with_password"]);
    const ids = collectFeatureIds(loaded);
    expect(ids.has("auth.sign_up")).toBe(true);
    expect(ids.has("auth.sign_in_with_password")).toBe(true);
    expect(ids.size).toBe(2);
  });
});
