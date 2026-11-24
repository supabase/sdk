import { join } from "node:path";
import type { Config } from "../src/index.ts";

export interface Fixture {
  readonly name: string;
  /** The folder the paths in `config` are relative to. */
  readonly directory: string;
  /** The config an SDK repository would write for this package. */
  readonly config: Config;
  /** The public functions that have no doc comment, and an empty summary. */
  readonly undocumented: readonly string[];
  /** The functions that the config's `exclude` leaves out. */
  readonly excluded: readonly string[];
}

const FIXTURES = join(import.meta.dir, "fixtures");

/**
 * A Swift package built into symbol graphs by the Swift compiler. Sources in
 * `fixtures/swift/package`, refreshed by `bun run refresh-fixtures`.
 */
export const swiftFixture: Fixture = {
  name: "swift",
  directory: join(FIXTURES, "swift"),
  config: {
    source: {
      format: "swift-symbol-graph",
      directory: "symbol-graphs",
      modules: ["Notes", "NotesKit"],
    },
    output: "expected",
    // The initializer of the client is documented. Those of the value types
    // a caller passes to it are not: their fields are already listed where a
    // parameter takes them.
    exclude: ["(?<!^NotesClient)\\.init$"],
    // Every public function of the package has a doc comment, and has to.
    strict: true,
    preview: { path: "swift", title: "Swift" },
  },
  undocumented: [],
  excluded: [
    "Channel.init",
    "CreateOptions.init",
    "Folder.init",
    "NotesClient.Configuration.init",
    "Page.init",
    "Query.init",
    "ShareOptions.init",
  ],
};

/**
 * A Python package dumped by griffe. Sources in `fixtures/python/package`,
 * refreshed by `bun run refresh-fixtures`.
 */
export const pythonFixture: Fixture = {
  name: "python",
  directory: join(FIXTURES, "python"),
  config: {
    source: {
      format: "griffe",
      file: "griffe.json",
      unwrapReturns: ["notes._io.HttpMethod"],
      symbolPaths: { "notes.SyncNotesClient": "client" },
    },
    output: "expected",
    preview: { path: "python/v3", title: "Python" },
  },
  undocumented: [
    "notes.AsyncNotesClient.archive",
    "notes.NotesClient.in_folder",
    "notes.SyncNotesClient.archive",
  ],
  excluded: [],
};

export const fixtures: readonly Fixture[] = [swiftFixture, pythonFixture];
