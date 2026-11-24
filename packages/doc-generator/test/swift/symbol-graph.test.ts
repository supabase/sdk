import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  type ApiModel,
  type ApiSymbol,
  type CallableSymbol,
  GeneratorError,
} from "../../src/index.ts";
import {
  parseSymbolGraph,
  readSymbolGraphs,
  type SymbolGraph,
  swiftModel,
} from "../../src/sources/swift/symbol-graph.ts";
import { swiftFixture } from "../fixtures.ts";

const graphs = readSymbolGraphs(join(swiftFixture.directory, "symbol-graphs"));
const model = swiftModel(graphs, ["Notes", "NotesKit"]);

/** The functions of one name, which are overloads, in source order. */
const callables = (name: string, from: ApiModel = model): CallableSymbol[] =>
  from.symbols
    .filter((symbol) => symbol.kind === "callable")
    .filter((symbol) => symbol.name === name)
    .sort((a, b) => a.position.line - b.position.line);

/**
 * The symbol the model has for a path of the source, such as
 * `CreateOptions.tags`. Only a function has a name in the model, so the
 * graphs say which id the path has.
 */
const at = (path: string): ApiSymbol | undefined => {
  const id = graphs
    .flatMap((graph) => graph.symbols)
    .find((symbol) => symbol.pathComponents.join(".") === path)
    ?.identifier.precise;
  return model.symbols.find((symbol) => symbol.id === id);
};

const callable = (name: string): CallableSymbol => {
  const [symbol, ...rest] = callables(name);
  if (symbol === undefined || rest.length > 0) {
    throw new Error(`expected one callable named ${name}`);
  }
  return symbol;
};

describe("swiftModel", () => {
  test("speaks Swift", () => {
    expect(model.language).toBe("swift");
  });

  test("keeps one copy of a symbol that a module re-exports, the documented one", () => {
    // NotesKit re-exports Notes, so both graphs hold `create`.
    const copies = graphs.flatMap((graph) =>
      graph.symbols.filter(
        (symbol) =>
          symbol.pathComponents.join(".") ===
          "NotesClient.create(title:body:options:)",
      ),
    );
    expect(copies.length).toBeGreaterThan(1);
    const [create] = callables("NotesClient.create");
    expect(create?.symbol).toBe(
      "Notes.NotesClient.create(title:body:options:)",
    );
    expect(create?.doc.summary).toBe("Creates a note with a title and a body.");
  });

  test("gives overloads one name and keeps them apart by id", () => {
    expect(
      callables("NotesClient.create").map((symbol) => symbol.symbol),
    ).toEqual([
      "Notes.NotesClient.create(title:body:options:)",
      "Notes.NotesClient.create(contentsOf:options:)",
    ]);
    expect(new Set(model.symbols.map((symbol) => symbol.id)).size).toBe(
      model.symbols.length,
    );
  });

  test("reads the declaration, with defaults and effects", () => {
    const [create] = callables("NotesClient.create");
    expect(create?.signature).toBe(
      "func create(title: String, body: String, options: CreateOptions = .init()) async throws -> Note",
    );
    expect(create?.returns).toEqual({ text: "Note" });
    expect(
      create?.parameters.map(({ name, required }) => [name, required]),
    ).toEqual([
      ["title", true],
      ["body", true],
      ["options", false],
    ]);
  });

  test("converts literal defaults and keeps other expressions as source", () => {
    expect(
      callable("NotesClient.tag").parameters.map(
        (parameter) => parameter.default,
      ),
    ).toEqual([undefined, undefined, ", ", "nil"]);
  });

  test("puts a default that the source wraps on one line", () => {
    expect(callable("NotesClient.Configuration.init").signature).toBe(
      "init(timeout: TimeInterval = NotesClient.Configuration.defaultTimeout, headers: [String : String] = [:])",
    );
  });

  test("names a parameter by its label and documents it by its internal name", () => {
    expect(callable("NotesClient.delete").parameters).toEqual([
      {
        name: "withID",
        type: { text: "UUID" },
        required: true,
        variadic: false,
        description: "The `Note.id` of the note to delete.",
      },
    ]);
    expect(callable("NotesClient.tag").parameters[1]).toMatchObject({
      name: "with",
      type: { text: "String..." },
      variadic: true,
      description: "The tags to add.",
    });
  });

  test("has no return type for a function that returns nothing", () => {
    expect(callable("NotesClient.delete").returns).toBeUndefined();
    expect(callable("NotesClient.init").returns).toBeUndefined();
  });

  test("titles an initializer with its type", () => {
    expect(callable("NotesClient.init").title).toBe("NotesClient.init");
    expect(callable("NotesClient.Configuration.init").title).toBe(
      "NotesClient.Configuration.init",
    );
    expect(callable("NotesClient.delete").title).toBe("delete");
  });

  test("marks `@_spi` symbols experimental", () => {
    expect(callable("NotesClient.archive").stability).toBe("experimental");
    expect(callable("NotesClient.delete").stability).toBe("stable");
  });

  test("marks an unconditional deprecation and keeps its message", () => {
    expect(callable("NotesClient.remove").deprecated).toEqual({
      message: "Use delete(withID:) instead.",
    });
    expect(callable("NotesClient.erase").deprecated).toEqual({});
    expect(callable("NotesClient.delete").deprecated).toBeUndefined();
  });

  test("adds the constraints of a constrained extension to the signature", () => {
    const eq = callable("Query.eq");
    expect(eq.signature).toBe(
      "func eq(_ column: String, value: String) -> Query<Phase> where Phase: Filterable",
    );
    expect(eq.typeParams).toEqual(["Phase"]);
  });

  test("files an extension of another module's type under that module", () => {
    expect(callable("JSONDecoder.notes").symbol).toBe(
      "Foundation.JSONDecoder.notes()",
    );
    expect(callable("Array.decode").symbol).toBe(
      "Swift.Array.decode(as:decoder:)",
    );
  });

  test("includes the free functions of a module that re-exports another", () => {
    expect(callable("makeClient").symbol).toBe("NotesKit.makeClient(url:)");
  });

  test("links a parameter to a struct of the package, and to nothing else", () => {
    const [create] = callables("NotesClient.create");
    const options = create?.parameters[2]?.type;
    expect(options?.text).toBe("CreateOptions");
    expect(at("CreateOptions")?.id).toBe(options?.ref as string);
    // `String` is not of the package.
    expect(create?.parameters[0]?.type).toEqual({ text: "String" });
  });

  test("lists the properties a caller sets, in source order", () => {
    const options = at("CreateOptions");
    if (options?.kind !== "type") {
      throw new Error("CreateOptions should be a type");
    }
    const titles = options.properties.map((id) => {
      const property = model.symbols.find((symbol) => symbol.id === id);
      return property?.kind === "property" ? property.title : undefined;
    });
    // `isTagged` is computed and read-only.
    expect(titles).toEqual(["tags", "channel", "folder"]);
  });

  test("orders properties declared on one line by their column", () => {
    const page = at("Page");
    expect(page?.kind === "type" && page.properties).toEqual([
      at("Page.offset")?.id as string,
      at("Page.limit")?.id as string,
    ]);
  });

  test("describes a property, with its doc comment on one line", () => {
    expect(at("CreateOptions.channel")).toEqual({
      id: expect.any(String),
      position: expect.any(Object),
      kind: "property",
      title: "channel",
      type: { text: "Channel?" },
      required: false,
      description: "Who is told about the note. When `nil`, nobody is.",
    });
  });

  test("counts a computed property with a setter as one a caller sets", () => {
    const folder = at("Folder");
    expect(folder?.kind === "type" && folder.properties).toHaveLength(2);
  });

  test("inlines neither a class nor a struct that wraps a raw value", () => {
    // A class is an object with behavior; `Channel` is an open set of names.
    expect(at("NotesClient")).toBeUndefined();
    expect(at("Channel")).toBeUndefined();
    expect(at("CreateOptions.channel")).toMatchObject({
      type: { text: "Channel?" },
    });
  });

  test("hands over functions, and the types and properties they inline", () => {
    expect(at("Reading")).toBeUndefined();
    expect(at("NotesClient.Configuration.defaultTimeout")).toBeUndefined();
    expect(new Set(model.symbols.map((symbol) => symbol.kind))).toEqual(
      new Set(["callable", "type", "property"]),
    );
  });

  test("names a function by its path through the types, without labels", () => {
    const names = model.symbols.flatMap((symbol) =>
      symbol.kind === "callable" ? [symbol.name] : [],
    );
    // Every public function, method and initializer. The two `create`
    // overloads share a name.
    expect([...new Set(names)].sort()).toEqual([
      "Array.decode",
      "Channel.init",
      "CreateOptions.init",
      "Folder.init",
      "JSONDecoder.notes",
      "NotesClient.Configuration.init",
      "NotesClient.archive",
      "NotesClient.create",
      "NotesClient.delete",
      "NotesClient.erase",
      "NotesClient.init",
      "NotesClient.list",
      "NotesClient.remove",
      "NotesClient.share",
      "NotesClient.tag",
      "Page.init",
      "Query.eq",
      "Query.init",
      "ShareOptions.init",
      "makeClient",
    ]);
    expect(names).toHaveLength(21);
  });

  test("files a function under the module that declares it", () => {
    expect(callable("NotesClient.delete").module).toBe("Notes");
    expect(callable("makeClient").module).toBe("NotesKit");
    // An extension of `Swift.Array`, written in Notes.
    expect(callable("Array.decode").module).toBe("Notes");
  });

  test("never carries a path of the machine that built the graphs", () => {
    const callableText = JSON.stringify(
      model.symbols.map(({ position: _position, ...rest }) => rest),
    );
    expect(callableText).not.toContain("file://");
  });

  test("reads only the modules it is given", () => {
    const notesOnly = swiftModel(graphs, ["Notes"]);
    expect(callables("makeClient", notesOnly)).toEqual([]);
    expect(callables("NotesClient.delete", notesOnly)).toHaveLength(1);
  });

  test("fails when a module has no graph", () => {
    expect(() => swiftModel(graphs, ["Notes", "Missing"])).toThrow(
      new GeneratorError("No symbol graph was found for:", ["Missing"]),
    );
  });

  test("gives the same model whatever order the graphs and their contents are in", () => {
    const shuffled: SymbolGraph[] = graphs.toReversed().map((graph) => ({
      ...graph,
      symbols: graph.symbols.toReversed(),
      relationships: graph.relationships.toReversed(),
    }));
    expect(swiftModel(shuffled, ["NotesKit", "Notes"])).toEqual(model);
  });

  describe("two modules that declare one name", () => {
    /** `func run()` in a type or at the top of a module. */
    const run = (
      precise: string,
      path: string[],
      extendedModule?: string,
    ): SymbolGraph["symbols"][number] => ({
      kind: { identifier: path.length > 1 ? "swift.method" : "swift.func" },
      identifier: { precise },
      pathComponents: path,
      location: {
        uri: `file:///${precise}.swift`,
        position: { line: 1, character: 0 },
      },
      declarationFragments: [
        { kind: "keyword", spelling: "func" },
        { kind: "text", spelling: " " },
        { kind: "identifier", spelling: "run" },
        { kind: "text", spelling: "()" },
      ],
      ...(extendedModule === undefined
        ? {}
        : { swiftExtension: { extendedModule } }),
    });
    const graph = (
      name: string,
      ...symbols: SymbolGraph["symbols"][number][]
    ): SymbolGraph => ({ module: { name }, relationships: [], symbols });

    test("fail: their functions would share one definition", () => {
      const twice = [
        graph("B", run("b1", ["Job", "run()"]), run("b2", ["run()"])),
        graph("A", run("a1", ["Job", "run()"]), run("a2", ["run()"])),
      ];
      expect(() => swiftModel(twice, ["A", "B"])).toThrow(
        new GeneratorError(
          "More than one module declares a function of the same name, so their definitions would share an id:",
          ["Job.run: A, B", "run: A, B"],
        ),
      );
    });

    test("are fine when one extends the type of the other: that is an overload", () => {
      const extended = swiftModel(
        [
          graph("A", run("a1", ["Job", "run()"])),
          graph("B", run("b1", ["Job", "run()"], "A")),
        ],
        ["A", "B"],
      );
      expect(
        callables("Job.run", extended).map((symbol) => symbol.symbol),
      ).toEqual(["A.Job.run()", "A.Job.run()"]);
    });
  });

  test("fails on a declaration whose defaults it cannot match to its parameters", () => {
    const graph: SymbolGraph = {
      module: { name: "M" },
      relationships: [],
      symbols: [
        {
          kind: { identifier: "swift.func" },
          identifier: { precise: "s:1M1fyyF" },
          pathComponents: ["f(a:)"],
          location: {
            uri: "file:///M.swift",
            position: { line: 1, character: 0 },
          },
          declarationFragments: [
            { kind: "keyword", spelling: "func" },
            { kind: "text", spelling: " " },
            { kind: "identifier", spelling: "f" },
            { kind: "text", spelling: "()" },
          ],
          functionSignature: {
            parameters: [
              {
                name: "a",
                declarationFragments: [
                  { kind: "identifier", spelling: "a" },
                  { kind: "text", spelling: ": " },
                  { kind: "typeIdentifier", spelling: "Int" },
                ],
              },
            ],
          },
        },
      ],
    };
    expect(() => swiftModel([graph], ["M"])).toThrow(
      'Cannot match the defaults of "func f()" to its 1 parameters',
    );
  });
});

describe("parseSymbolGraph", () => {
  test("accepts what the compiler emits", () => {
    const graph = { module: { name: "M" }, symbols: [], relationships: [] };
    expect(parseSymbolGraph(graph, "M.symbols.json")).toBe(graph as never);
  });

  test("rejects JSON that is not a symbol graph, naming the file", () => {
    for (const json of [
      null,
      [],
      {},
      { module: { name: "M" }, symbols: [] },
      { module: {}, symbols: [], relationships: [] },
      { module: { name: "M" }, symbols: [{ kind: {} }], relationships: [] },
    ]) {
      expect(() => parseSymbolGraph(json, "x.symbols.json")).toThrow(
        new GeneratorError("x.symbols.json is not a Swift symbol graph."),
      );
    }
  });
});

describe("readSymbolGraphs", () => {
  test("reads every graph of a folder, in name order", () => {
    expect(graphs.map((graph) => graph.module.name)).toEqual([
      "Notes",
      "Notes",
      "Notes",
      "NotesKit",
      "NotesKit",
      "NotesKit",
    ]);
  });

  test("fails with a message when the folder does not exist", () => {
    expect(() =>
      readSymbolGraphs(join(swiftFixture.directory, "missing")),
    ).toThrow(/^Cannot read symbol graphs: /);
  });
});
