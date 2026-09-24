import { describe, expect, test } from "bun:test";
import {
  generateGo,
  generatePython,
  generateSwift,
  generateTypescript,
  sortGeneratorMetadata,
} from "@supabase/postgrest-typegen";
import {
  findLanguage,
  InvalidOptionError,
  TYPESCRIPT_FILE_NAME,
} from "../src/index.ts";
import { createFakeHost, rejection } from "./helpers.ts";
import { unsortedMetadata } from "./fixtures.ts";

const sorted = sortGeneratorMetadata(unsortedMetadata);
const generate = (name: string, options: Record<string, string | boolean>) =>
  findLanguage(name)!.generate(unsortedMetadata, options, createFakeHost());

describe("in-process languages", () => {
  test("typescript matches the generator with one-to-one detection on by default", async () => {
    expect(await generate("typescript", {})).toBe(
      `${await generateTypescript(sorted, { detectOneToOneRelationships: true })}\n`,
    );
  });

  test("typescript turns one-to-one detection off for --postgrest-v9-compat", async () => {
    const output = await generate("typescript", {
      "postgrest-v9-compat": true,
    });
    expect(output).toBe(
      `${await generateTypescript(sorted, { detectOneToOneRelationships: false })}\n`,
    );
    expect(output).not.toBe(await generate("typescript", {}));
  });

  test("typescript emits the PostgREST version a consumer passes", async () => {
    const output = await generate("typescript", { "postgrest-version": "12" });
    expect(output).toBe(
      `${await generateTypescript(sorted, {
        detectOneToOneRelationships: true,
        postgrestVersion: "12",
      })}\n`,
    );
    expect(output).toContain('PostgrestVersion: "12"');
    expect(await generate("typescript", {})).not.toContain("PostgrestVersion");
  });

  test("typescript defaults the helper types to public unless a consumer says otherwise", async () => {
    const output = await generate("typescript", {
      "default-schema": "inventory",
    });
    expect(output).toBe(
      `${await generateTypescript(sorted, {
        detectOneToOneRelationships: true,
        defaultSchema: "inventory",
      })}\n`,
    );
    expect(output).not.toBe(await generate("typescript", {}));
  });

  test("typescript formats through the host when it offers a formatter", async () => {
    const calls: string[] = [];
    const host = createFakeHost(undefined, {
      format: async (code, fileName) => {
        calls.push(fileName);
        return `// formatted by host\n${code}`;
      },
    });
    const output = await findLanguage("typescript")!.generate(
      unsortedMetadata,
      {},
      host,
    );
    expect(calls).toEqual([TYPESCRIPT_FILE_NAME]);
    expect(output).toBe(
      `// formatted by host\n${await generateTypescript(sorted, {
        detectOneToOneRelationships: true,
        format: async (code) => code,
      })}\n`,
    );
  });

  test("go matches the generator", async () => {
    expect(await generate("go", {})).toBe(`${generateGo(sorted)}\n`);
  });

  test("python matches the generator", async () => {
    expect(await generate("python", {})).toBe(`${generatePython(sorted)}\n`);
  });

  test("swift matches the generator for each access control", async () => {
    expect(await generate("swift", {})).toBe(
      `${generateSwift(sorted, { accessControl: "internal" })}\n`,
    );
    expect(await generate("swift", { "swift-access-control": "public" })).toBe(
      `${generateSwift(sorted, { accessControl: "public" })}\n`,
    );
  });

  test("sorts the metadata before generating", async () => {
    expect(await generate("go", {})).not.toBe(
      `${generateGo(unsortedMetadata)}\n`,
    );
  });

  test("ends every file with the single newline supabase gen types always emitted", async () => {
    for (const name of ["typescript", "go", "python", "swift"]) {
      const output = await generate(name, {});
      expect(output.endsWith("\n")).toBe(true);
      expect(output.endsWith("\n\n\n")).toBe(false);
    }
  });

  test("rejects the private and package access levels the CLI never offered", async () => {
    expect(
      await rejection(generate("swift", { "swift-access-control": "private" })),
    ).toBeInstanceOf(InvalidOptionError);
  });

  test("never spawns a process", async () => {
    const host = createFakeHost();
    for (const name of ["typescript", "go", "python", "swift"]) {
      await findLanguage(name)!.generate(unsortedMetadata, {}, host);
    }
    expect(host.requests).toEqual([]);
  });
});
