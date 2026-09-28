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
/** The pinned postgrest-typegen still returns Go, Python and Swift without their final newline. */
const asFile = (code: string) => (code.endsWith("\n") ? code : `${code}\n`);

describe("in-process languages", () => {
  test("typescript matches the generator with one-to-one detection on by default", async () => {
    expect(await generate("typescript", {})).toBe(
      await generateTypescript(sorted, { detectOneToOneRelationships: true }),
    );
  });

  test("typescript lets a consumer turn one-to-one detection off", async () => {
    const output = await generate("typescript", {
      "detect-one-to-one-relationships": false,
    });
    expect(output).toBe(
      await generateTypescript(sorted, {
        detectOneToOneRelationships: false,
      }),
    );
    expect(output).not.toBe(await generate("typescript", {}));
  });

  test("typescript emits the PostgREST version a consumer passes", async () => {
    const output = await generate("typescript", { "postgrest-version": "12" });
    expect(output).toBe(
      await generateTypescript(sorted, {
        detectOneToOneRelationships: true,
        postgrestVersion: "12",
      }),
    );
    expect(output).toContain('PostgrestVersion: "12"');
    expect(await generate("typescript", {})).not.toContain("PostgrestVersion");
  });

  test("typescript defaults the helper types to public unless a consumer says otherwise", async () => {
    const output = await generate("typescript", {
      "default-schema": "inventory",
    });
    expect(output).toBe(
      await generateTypescript(sorted, {
        detectOneToOneRelationships: true,
        defaultSchema: "inventory",
      }),
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
      })}`,
    );
  });

  test("go matches the generator", async () => {
    expect(await generate("go", {})).toBe(asFile(generateGo(sorted)));
  });

  test("python matches the generator", async () => {
    expect(await generate("python", {})).toBe(asFile(generatePython(sorted)));
  });

  test("swift matches the generator for each access control", async () => {
    expect(await generate("swift", {})).toBe(
      asFile(generateSwift(sorted, { accessControl: "internal" })),
    );
    expect(await generate("swift", { "swift-access-control": "public" })).toBe(
      asFile(generateSwift(sorted, { accessControl: "public" })),
    );
  });

  test("sorts the metadata before generating", async () => {
    expect(await generate("go", {})).not.toBe(
      asFile(generateGo(unsortedMetadata)),
    );
  });

  test("ends every file with exactly one newline", async () => {
    for (const name of ["typescript", "go", "python", "swift"]) {
      const output = await generate(name, {});
      expect(output.endsWith("\n")).toBe(true);
      expect(output.endsWith("\n\n")).toBe(false);
    }
  });

  test("restores the final newline when the host formatter drops it", async () => {
    const host = createFakeHost(undefined, {
      format: async (code) => code.trimEnd(),
    });
    const output = await findLanguage("typescript")!.generate(
      unsortedMetadata,
      {},
      host,
    );
    expect(output.endsWith("\n")).toBe(true);
    expect(output.endsWith("\n\n")).toBe(false);
  });

  test("swift accepts every access level the generator knows", async () => {
    for (const accessControl of ["private", "package"] as const) {
      expect(
        await generate("swift", { "swift-access-control": accessControl }),
      ).toBe(asFile(generateSwift(sorted, { accessControl })));
    }
    expect(
      await rejection(generate("swift", { "swift-access-control": "open" })),
    ).toBeInstanceOf(InvalidOptionError);
  });

  test("runs without a process runner on the host", async () => {
    const { spawn: _spawn, ...hostWithoutSpawn } = createFakeHost();
    for (const name of ["typescript", "go", "python", "swift"]) {
      expect(
        await findLanguage(name)!.generate(
          unsortedMetadata,
          {},
          hostWithoutSpawn,
        ),
      ).toBe(
        await findLanguage(name)!.generate(
          unsortedMetadata,
          {},
          createFakeHost(),
        ),
      );
    }
  });

  test("never spawns a process", async () => {
    const host = createFakeHost();
    for (const name of ["typescript", "go", "python", "swift"]) {
      await findLanguage(name)!.generate(unsortedMetadata, {}, host);
    }
    expect(host.requests).toEqual([]);
  });
});
