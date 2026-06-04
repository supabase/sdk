import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadAreas } from "../src/load";

const here = dirname(fileURLToPath(import.meta.url));
const validDir = join(here, "fixtures", "valid");

describe("loadAreas", () => {
  it("loads and parses every .yaml file in a directory", () => {
    const { areas, findings } = loadAreas(validDir);
    expect(findings).toEqual([]);
    expect(areas).toHaveLength(1);
    expect(areas[0].area.area).toBe("auth");
    expect(areas[0].area.features[0].id).toBe("auth.sign_in_with_otp");
    expect(areas[0].file.endsWith("auth.yaml")).toBe(true);
  });
});
