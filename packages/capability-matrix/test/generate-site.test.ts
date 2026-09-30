import { describe, it, expect } from "bun:test";
import { renderHtml } from "../src/generate-site";
import type { LoadedArea, ParityReport } from "../src/types";

const areas: LoadedArea[] = [
  {
    file: "auth.yaml",
    area: {
      area: "auth",
      title: "Auth",
      description: "Auth features",
      features: [
        {
          id: "auth.sign_in.email",
          name: "Sign in with email",
          description: "Email + password",
          group: "sign_in",
        },
      ],
    },
  },
];

const parity: ParityReport = {
  overall: 0,
  coverageScope: 0,
  perLanguage: {
    javascript: 0,
    flutter: 0,
    python: 0,
    swift: 0,
    csharp: 0,
    go: 0,
    kotlin: 0,
  },
  perArea: { auth: 0 },
};

const html = renderHtml(areas, {}, parity, new Set(), "2026-01-01");

describe("renderHtml search", () => {
  it("renders a search input", () => {
    expect(html).toContain('<input type="search" id="feature-search"');
  });

  it("tags each feature row with its id", () => {
    expect(html).toContain('<tr data-id="auth.sign_in.email">');
  });

  it("renders a hidden no-results message", () => {
    expect(html).toContain('id="search-empty"');
  });
});
