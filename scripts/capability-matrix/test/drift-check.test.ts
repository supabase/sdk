import { describe, it, expect } from "vitest";
import { checkDrift, formatDriftSummary } from "../src/drift-check";
import type { ParsedSymbol } from "../src/normalize-typedoc";

function sym(name: string): ParsedSymbol {
  return { name, kind: "method", file: "src/index.ts" };
}

describe("checkDrift", () => {
  it("returns no finding when a registered symbol is present", () => {
    const compliance = {
      sdk: "javascript",
      features: {
        "auth.sign_up": { status: "implemented", symbols: ["AuthClient.signUp"] },
      },
    };
    expect(checkDrift([sym("AuthClient.signUp")], compliance)).toEqual([]);
  });

  it("reports a finding when a registered symbol is missing", () => {
    const compliance = {
      sdk: "javascript",
      features: {
        "auth.mfa.enroll": { status: "implemented", symbols: ["MFAApi.enroll"] },
      },
    };
    expect(checkDrift([], compliance)).toEqual([
      { featureId: "auth.mfa.enroll", symbol: "MFAApi.enroll" },
    ]);
  });

  it("reports one finding per missing symbol when multiple are registered", () => {
    const compliance = {
      sdk: "javascript",
      features: {
        "auth.sign_up": {
          status: "implemented",
          symbols: ["AuthClient.signUp", "AuthClient.signUpAnon"],
        },
      },
    };
    expect(checkDrift([sym("AuthClient.signUp")], compliance)).toEqual([
      { featureId: "auth.sign_up", symbol: "AuthClient.signUpAnon" },
    ]);
  });

  it("skips entries that are not status implemented", () => {
    const compliance = {
      sdk: "javascript",
      features: {
        "auth.sign_up": { status: "not_implemented", symbols: ["AuthClient.signUp"] },
      },
    };
    expect(checkDrift([], compliance)).toEqual([]);
  });

  it("reports an unverifiable finding when an implemented entry has no symbols list", () => {
    const compliance = {
      sdk: "javascript",
      features: {
        "auth.mfa.enroll": { status: "implemented" },
      },
    };
    expect(checkDrift([], compliance)).toEqual([{ featureId: "auth.mfa.enroll" }]);
  });

  it("reports an unverifiable finding when an implemented entry has an empty symbols list", () => {
    const compliance = {
      sdk: "javascript",
      features: {
        "auth.mfa.enroll": { status: "implemented", symbols: [] },
      },
    };
    expect(checkDrift([], compliance)).toEqual([{ featureId: "auth.mfa.enroll" }]);
  });

  it("reports an unverifiable finding for the string status shorthand", () => {
    const compliance = {
      sdk: "javascript",
      features: {
        "auth.mfa.enroll": "implemented",
      },
    };
    expect(checkDrift([], compliance)).toEqual([{ featureId: "auth.mfa.enroll" }]);
  });
});

describe("formatDriftSummary", () => {
  it("includes the marker and the symbol-not-found section", () => {
    const msg = formatDriftSummary(
      [{ featureId: "auth.mfa.enroll", symbol: "MFAApi.enroll" }],
      "supabase-flutter",
    );
    expect(msg).toContain("<!-- capability-matrix-drift -->");
    expect(msg).toContain("⚠️ Capability matrix drift detected");
    expect(msg).toContain("could not be found in supabase-flutter");
    expect(msg).toContain("auth.mfa.enroll → expected symbol: MFAApi.enroll");
  });

  it("includes the unverifiable section for symbol-less findings", () => {
    const msg = formatDriftSummary([{ featureId: "auth.mfa.enroll" }], "supabase-flutter");
    expect(msg).toContain("no registered symbols to verify");
    expect(msg).toContain(
      "auth.mfa.enroll (no `symbols` list — cannot confirm implementation exists)",
    );
  });

  it("omits the symbol-not-found section when there are no such findings", () => {
    const msg = formatDriftSummary([{ featureId: "auth.mfa.enroll" }], "javascript");
    expect(msg).not.toContain("could not be found in javascript");
  });

  it("omits the unverifiable section when there are no such findings", () => {
    const msg = formatDriftSummary(
      [{ featureId: "auth.mfa.enroll", symbol: "MFAApi.enroll" }],
      "javascript",
    );
    expect(msg).not.toContain("no registered symbols to verify");
  });
});
