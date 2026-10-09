import { describe, expect, test } from "bun:test";
import {
  serializeGeneratorMetadata,
  sortGeneratorMetadata,
} from "@supabase/postgrest-typegen";
import {
  InvalidOptionError,
  MetadataRejectedError,
  swift,
  ToolFailedError,
  ToolNotInstalledError,
} from "../src/index.ts";
import { commandNotFound, createFakeHost, rejection } from "./helpers.ts";
import { unsortedMetadata } from "./fixtures.ts";

const success = (stdout: string) => ({ exitCode: 0, stdout, stderr: "" });

describe("swift", () => {
  test("runs supabase-typegen in the project with the sorted document on stdin", async () => {
    const host = createFakeHost(() => success("struct Tickets {}\n"));
    const output = await swift.generate(unsortedMetadata, {}, host);

    expect(output).toBe("struct Tickets {}\n");
    const request = host.requests[0]!;
    expect(request.command).toBe("supabase-typegen");
    expect(request.args).toEqual(["--access-control", "internal"]);
    expect(request.cwd).toBe(host.cwd);
    expect(request.stdin).toBe(
      serializeGeneratorMetadata(sortGeneratorMetadata(unsortedMetadata)),
    );
  });

  test("maps swift-access-control to --access-control", async () => {
    const host = createFakeHost(() => success(""));
    await swift.generate(
      unsortedMetadata,
      { "swift-access-control": "public" },
      host,
    );
    expect(host.requests[0]!.args).toEqual(["--access-control", "public"]);
  });

  test("rejects the levels the generator does not accept before spawning", async () => {
    for (const level of ["private", "package"]) {
      const host = createFakeHost();
      expect(
        await rejection(
          swift.generate(
            unsortedMetadata,
            { "swift-access-control": level },
            host,
          ),
        ),
      ).toBeInstanceOf(InvalidOptionError);
      expect(host.requests).toHaveLength(0);
    }
  });

  test("reports a missing supabase-typegen with an install hint", async () => {
    const host = createFakeHost(() => {
      throw commandNotFound("supabase-typegen");
    });
    const error = await rejection(swift.generate(unsortedMetadata, {}, host));
    expect(error).toBeInstanceOf(ToolNotInstalledError);
    const notInstalled = error as ToolNotInstalledError;
    expect(notInstalled.tool).toBe("supabase-typegen");
    expect(notInstalled.installHint).toContain(
      "https://github.com/supabase/supabase-swift/releases",
    );
  });

  test("reports exit 65 as a rejected document", async () => {
    const host = createFakeHost(() => ({
      exitCode: 65,
      stdout: "",
      stderr: "error: unsupported GeneratorMetadata version '7'.\n",
    }));
    const error = await rejection(swift.generate(unsortedMetadata, {}, host));
    expect(error).toBeInstanceOf(MetadataRejectedError);
    expect((error as MetadataRejectedError).stderr).toBe(
      "error: unsupported GeneratorMetadata version '7'.",
    );
  });

  test("reports any other failure with the exit code and stderr", async () => {
    const host = createFakeHost(() => ({
      exitCode: 1,
      stdout: "",
      stderr: "error: the primary key column 'todos.id' is nullable.\n",
    }));
    const error = await rejection(swift.generate(unsortedMetadata, {}, host));
    expect(error).toBeInstanceOf(ToolFailedError);
    expect(error).not.toBeInstanceOf(MetadataRejectedError);
    expect((error as ToolFailedError).message).toBe(
      "`supabase-typegen --access-control internal` exited with code 1.\nerror: the primary key column 'todos.id' is nullable.",
    );
  });
});
