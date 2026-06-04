import { describe, it, expect } from "vitest";
import { LANGUAGES, STATUSES } from "../src/types";

describe("constants", () => {
  it("tracks exactly the seven canonical languages", () => {
    expect([...LANGUAGES].sort()).toEqual(
      ["csharp", "flutter", "go", "javascript", "kotlin", "python", "swift"]
    );
  });

  it("defines the three status values", () => {
    expect([...STATUSES].sort()).toEqual(
      ["implemented", "not_applicable", "not_implemented"]
    );
  });
});
