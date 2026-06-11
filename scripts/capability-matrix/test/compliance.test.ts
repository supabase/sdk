import { describe, it, expect } from "vitest";
import { validateCompliance, normalizeCompliance, collectFeatureIds } from "../src/compliance";
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

describe("collectFeatureIds", () => {
  it("collects all feature ids from loaded areas", () => {
    const loaded = areas(["auth.sign_up", "auth.sign_in_with_password"]);
    const ids = collectFeatureIds(loaded);
    expect(ids.has("auth.sign_up")).toBe(true);
    expect(ids.has("auth.sign_in_with_password")).toBe(true);
    expect(ids.size).toBe(2);
  });
});
