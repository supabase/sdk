import { describe, it, expect } from "vitest";
import { buildSourceMap } from "../src/compliance-source-map";

describe("buildSourceMap", () => {
  it("maps each symbol to its 1-based line number", () => {
    const yamlText = [
      "sdk: javascript",
      "features:",
      "  auth.sign_up:",
      "    status: implemented",
      "    symbols:",
      "      - AuthClient.signUp",
      "      - AuthClient.signUpAnon",
      "  auth.sign_in:",
      "    status: implemented",
      "    symbols:",
      "      - AuthClient.signIn",
    ].join("\n");

    const { symbolLines } = buildSourceMap(yamlText);

    expect(symbolLines.get("AuthClient.signUp")).toBe(6);
    expect(symbolLines.get("AuthClient.signUpAnon")).toBe(7);
    expect(symbolLines.get("AuthClient.signIn")).toBe(11);
  });

  it("maps each feature id to its own key line", () => {
    const yamlText = [
      "sdk: javascript",
      "features:",
      "  auth.sign_up:",
      "    status: implemented",
      "  auth.mfa.enroll:",
      "    status: implemented",
    ].join("\n");

    const { featureLines } = buildSourceMap(yamlText);

    expect(featureLines.get("auth.sign_up")).toBe(3);
    expect(featureLines.get("auth.mfa.enroll")).toBe(5);
  });

  it("returns empty maps for a compliance file with no features", () => {
    const { symbolLines, featureLines } = buildSourceMap("sdk: javascript\nfeatures: {}\n");
    expect(symbolLines.size).toBe(0);
    expect(featureLines.size).toBe(0);
  });
});
