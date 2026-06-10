import { describe, it, expect } from "vitest";
import { checkStructural } from "../src/structural";
import type { LoadedArea } from "../src/types";

function area(file: string, areaName: string, features: unknown[]): LoadedArea {
  return { file, area: { area: areaName, title: "T", description: "d", features: features as never } };
}

describe("checkStructural", () => {
  it("passes a clean single file", () => {
    const a = area("/x/auth.yaml", "auth", [
      { id: "auth.f", name: "F", description: "d" },
    ]);
    expect(checkStructural([a])).toEqual([]);
  });

  it("flags area not matching filename", () => {
    const a = area("/x/storage.yaml", "auth", [
      { id: "auth.f", name: "F", description: "d" },
    ]);
    expect(checkStructural([a]).some((f) => f.message.includes("does not match filename"))).toBe(true);
  });

  it("flags id without the area prefix", () => {
    const a = area("/x/auth.yaml", "auth", [
      { id: "storage.f", name: "F", description: "d" },
    ]);
    expect(checkStructural([a]).some((f) => f.message.includes("must start with"))).toBe(true);
  });

  it("flags a duplicate id across files", () => {
    const a = area("/x/auth.yaml", "auth", [{ id: "auth.f", name: "F", description: "d" }]);
    const b = area("/x/auth.yaml", "auth", [{ id: "auth.f", name: "F2", description: "d" }]);
    expect(checkStructural([a, b]).some((f) => f.message.includes("duplicate feature id"))).toBe(true);
  });
});
