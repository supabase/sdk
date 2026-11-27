import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeDefinitions } from "../src/write.ts";

const definition = (id: string, summary = "S."): string =>
  `---\nid: "${id}"\nkind: "method"\ntitle: "t"\nsummary: "${summary}"\n---\n`;

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "doc-generator-write-"));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

const listing = (): string[] => readdirSync(directory).sort();

describe("writeDefinitions", () => {
  test("creates the folder, parents included", () => {
    const nested = join(directory, "docs", "api-docs", "definitions");
    writeDefinitions(nested, [{ name: "a-b.md", content: definition("a-b") }]);
    expect(readFileSync(join(nested, "a-b.md"), "utf8")).toBe(
      definition("a-b"),
    );
  });

  test("removes the definitions of an earlier run that are gone now", () => {
    writeDefinitions(directory, [
      { name: "kept.md", content: definition("kept", "Old.") },
      { name: "gone.md", content: definition("gone") },
    ]);
    writeDefinitions(directory, [
      { name: "kept.md", content: definition("kept", "New.") },
      { name: "new.md", content: definition("new") },
    ]);
    expect(listing()).toEqual(["kept.md", "new.md"]);
    expect(readFileSync(join(directory, "kept.md"), "utf8")).toBe(
      definition("kept", "New."),
    );
  });

  test("removes definitions written with Windows line endings or bare ids", () => {
    writeFileSync(
      join(directory, "crlf.md"),
      definition("crlf").replaceAll("\n", "\r\n"),
    );
    writeFileSync(
      join(directory, "bare.md"),
      "---\nid: bare\nkind: type\n---\n",
    );
    writeDefinitions(directory, []);
    expect(listing()).toEqual([]);
  });

  test("leaves alone everything that is not a definition it could have written", () => {
    // A wrong `output` path must not cost anyone their files.
    const others: Record<string, string> = {
      "README.md": "# Read me\n",
      "index.md": "---\ntitle: Index\n---\n\nHand-written.\n",
      "other-id.md": definition("not-the-file-name"),
      "notes.txt": definition("notes"),
      "Upper-Case.md": definition("Upper-Case"),
    };
    for (const [name, content] of Object.entries(others)) {
      writeFileSync(join(directory, name), content);
    }
    mkdirSync(join(directory, "folder.md"));
    writeDefinitions(directory, [{ name: "a.md", content: definition("a") }]);
    expect(listing()).toEqual([
      "README.md",
      "Upper-Case.md",
      "a.md",
      "folder.md",
      "index.md",
      "notes.txt",
      "other-id.md",
    ]);
    for (const [name, content] of Object.entries(others)) {
      expect(readFileSync(join(directory, name), "utf8")).toBe(content);
    }
  });

  test("writing the same files twice leaves the same folder", () => {
    const files = [
      { name: "a.md", content: definition("a") },
      { name: "b.md", content: definition("b") },
    ];
    writeDefinitions(directory, files);
    writeDefinitions(directory, files);
    expect(listing()).toEqual(["a.md", "b.md"]);
  });
});
