import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadIgnore } from "../src/parse-ignore";

function makeTempDir(suffix: string): string {
  const dir = join(tmpdir(), `sdk-parse-ignore-test-${suffix}-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("loadIgnore", () => {
  it("returns non-ignoring instance when file is absent", () => {
    const ig = loadIgnore("/nonexistent/path/that/does/not/exist");
    expect(ig.ignores("anything.ts")).toBe(false);
    expect(ig.ignores("Tests/Foo.swift")).toBe(false);
  });

  it("applies patterns from sdk-parse-ignore", () => {
    const dir = makeTempDir("patterns");
    writeFileSync(join(dir, "sdk-parse-ignore"), "Tests/\n**/*.test.ts\n");
    const ig = loadIgnore(dir);
    expect(ig.ignores("Tests/AuthTests.swift")).toBe(true);
    expect(ig.ignores("src/auth.test.ts")).toBe(true);
    expect(ig.ignores("src/auth.ts")).toBe(false);
  });

  it("ignores comment lines and blank lines", () => {
    const dir = makeTempDir("comments");
    writeFileSync(join(dir, "sdk-parse-ignore"), "# comment\n\nTests/\n");
    const ig = loadIgnore(dir);
    expect(ig.ignores("Tests/Foo.swift")).toBe(true);
  });

  it("supports negation to un-ignore a subdirectory", () => {
    const dir = makeTempDir("negation");
    writeFileSync(join(dir, "sdk-parse-ignore"), "Tests/*\n!Tests/Helpers/\n");
    const ig = loadIgnore(dir);
    expect(ig.ignores("Tests/AuthTests.swift")).toBe(true);
    expect(ig.ignores("Tests/Helpers/Mock.swift")).toBe(false);
  });
});
