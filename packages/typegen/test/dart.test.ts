import { describe, expect, test } from "bun:test";
import {
  serializeGeneratorMetadata,
  sortGeneratorMetadata,
} from "@supabase/postgrest-typegen";
import {
  dart,
  MetadataRejectedError,
  ToolFailedError,
  ToolNotInstalledError,
} from "../src/index.ts";
import { commandNotFound, createFakeHost, rejection } from "./helpers.ts";
import { unsortedMetadata } from "./fixtures.ts";

const success = (stdout: string) => ({ exitCode: 0, stdout, stderr: "" });

describe("dart", () => {
  test("runs supabase_typegen in the project with the sorted document on stdin", async () => {
    const controller = new AbortController();
    const host = createFakeHost(() => success("class Tickets {}\n"), {
      signal: controller.signal,
    });
    const output = await dart.generate(unsortedMetadata, {}, host);

    expect(output).toBe("class Tickets {}\n");
    expect(host.requests).toHaveLength(1);
    const request = host.requests[0]!;
    expect(request.command).toBe("dart");
    expect(request.args).toEqual(["run", "supabase_typegen", "--output", "-"]);
    expect(request.cwd).toBe(host.cwd);
    expect(request.env).toBe(host.env);
    expect(request.signal).toBe(controller.signal);
    expect(request.stdin).toBe(
      serializeGeneratorMetadata(sortGeneratorMetadata(unsortedMetadata)),
    );
  });

  test("returns stdout verbatim and ignores the summary on stderr", async () => {
    const host = createFakeHost(() => ({
      exitCode: 0,
      stdout: "code",
      stderr:
        'Generated stdout with 2 tables and 1 enums from schema "public".\n',
    }));
    expect(await dart.generate(unsortedMetadata, {}, host)).toBe("code");
  });

  test("reports a missing dart executable with an install hint", async () => {
    const host = createFakeHost(() => {
      throw commandNotFound("dart");
    });
    const error = await rejection(dart.generate(unsortedMetadata, {}, host));
    expect(error).toBeInstanceOf(ToolNotInstalledError);
    const notInstalled = error as ToolNotInstalledError;
    expect(notInstalled.language).toBe("dart");
    expect(notInstalled.tool).toBe("dart");
    expect(notInstalled.installHint).toContain("https://dart.dev/get-dart");
    expect(notInstalled.message).toContain(
      "`dart`, which was not found on PATH",
    );
    expect(notInstalled.cause).toMatchObject({ code: "ENOENT" });
  });

  test("reports a project without the supabase_typegen package with an install hint", async () => {
    const host = createFakeHost(() => ({
      exitCode: 255,
      stdout: "",
      stderr:
        "Could not find package `supabase_typegen` or file `supabase_typegen`\n",
    }));
    const error = await rejection(dart.generate(unsortedMetadata, {}, host));
    expect(error).toBeInstanceOf(ToolNotInstalledError);
    const notInstalled = error as ToolNotInstalledError;
    expect(notInstalled.tool).toBe("the supabase_typegen package");
    expect(notInstalled.installHint).toContain(
      "dart pub add --dev supabase_typegen",
    );
    expect(notInstalled.message).toContain("/projects/app");
    expect(notInstalled.message).toContain(
      "Could not find package `supabase_typegen`",
    );
  });

  test("reports a directory without a pubspec as a missing package", async () => {
    const host = createFakeHost(() => ({
      exitCode: 255,
      stdout: "",
      stderr:
        "Found no `pubspec.yaml` file in `/projects/app` or parent directories\n",
    }));
    expect(
      await rejection(dart.generate(unsortedMetadata, {}, host)),
    ).toBeInstanceOf(ToolNotInstalledError);
  });

  test("reports a rejected document with the version that was sent", async () => {
    const host = createFakeHost(() => ({
      exitCode: 65,
      stdout: "",
      stderr: "Could not parse the document: unsupported version 7.\n",
    }));
    const error = await rejection(dart.generate(unsortedMetadata, {}, host));
    expect(error).toBeInstanceOf(MetadataRejectedError);
    expect(error).toBeInstanceOf(ToolFailedError);
    const rejected = error as MetadataRejectedError;
    expect(rejected.version).toBe(unsortedMetadata.version);
    expect(rejected.exitCode).toBe(65);
    expect(rejected.stderr).toBe(
      "Could not parse the document: unsupported version 7.",
    );
    expect(rejected.command).toEqual([
      "dart",
      "run",
      "supabase_typegen",
      "--output",
      "-",
    ]);
    expect(rejected.message).toContain("version 1");
    expect(rejected.message).toContain("unsupported version 7.");
  });

  test("reports any other failure with the exit code and stderr", async () => {
    const host = createFakeHost(() => ({
      exitCode: 78,
      stdout: "",
      stderr:
        "The project is on Dart 3.0.0, but the generated code needs Dart 3.6.0 or newer.\n",
    }));
    const error = await rejection(dart.generate(unsortedMetadata, {}, host));
    expect(error).toBeInstanceOf(ToolFailedError);
    expect(error).not.toBeInstanceOf(MetadataRejectedError);
    const failed = error as ToolFailedError;
    expect(failed.exitCode).toBe(78);
    expect(failed.message).toBe(
      "`dart run supabase_typegen --output -` exited with code 78.\nThe project is on Dart 3.0.0, but the generated code needs Dart 3.6.0 or newer.",
    );
  });

  test("reports a signal-terminated tool", async () => {
    const host = createFakeHost(() => ({
      exitCode: null,
      stdout: "",
      stderr: "",
    }));
    const error = await rejection(dart.generate(unsortedMetadata, {}, host));
    expect(error).toBeInstanceOf(ToolFailedError);
    expect((error as ToolFailedError).exitCode).toBeNull();
    expect((error as ToolFailedError).message).toContain(
      "was terminated by a signal",
    );
  });

  test("passes through errors the host raises for other reasons", async () => {
    const host = createFakeHost(() => {
      throw new Error("host exploded");
    });
    expect(await rejection(dart.generate(unsortedMetadata, {}, host))).toEqual(
      new Error("host exploded"),
    );
  });
});
