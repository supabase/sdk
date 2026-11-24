import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  type ApiModel,
  type ApiSymbol,
  type CallableSymbol,
  GeneratorError,
} from "../../src/index.ts";
import {
  type GriffeDump,
  griffeModel,
  parseGriffeDump,
  readGriffeDump,
} from "../../src/sources/python/griffe.ts";
import { pythonFixture } from "../fixtures.ts";

const dump = readGriffeDump(join(pythonFixture.directory, "griffe.json"));
const options = {
  unwrapReturns: ["notes._io.HttpMethod"],
  symbolPaths: { "notes.SyncNotesClient": "client" },
};
const model = griffeModel(dump, options);

/** The symbol defined at a path, which is its id. */
const at = (path: string, from: ApiModel = model): ApiSymbol | undefined =>
  from.symbols.find((symbol) => symbol.id === path);

const callables = (from: ApiModel): CallableSymbol[] =>
  from.symbols.filter((symbol) => symbol.kind === "callable");

/** The function a caller imports by `name`. */
const callable = (name: string, from: ApiModel = model): CallableSymbol => {
  const [symbol, ...rest] = callables(from).filter(
    (candidate) => candidate.name === name,
  );
  if (symbol === undefined || rest.length > 0) {
    throw new Error(`expected one callable named ${name}`);
  }
  return symbol;
};

const propertyTitles = (path: string): (string | undefined)[] => {
  const type = at(path);
  if (type?.kind !== "type") {
    throw new Error(`expected ${path} to be a type`);
  }
  return type.properties.map((id) => {
    const property = model.symbols.find((symbol) => symbol.id === id);
    return property?.kind === "property" ? property.title : undefined;
  });
};

describe("griffeModel", () => {
  test("speaks Python", () => {
    expect(model.language).toBe("python");
  });

  test("names a function by the path a caller imports it by", () => {
    // `notes/__init__.py` re-exports the class and the function.
    expect(callable("notes.SyncNotesClient.create").id).toBe(
      "notes.client.SyncNotesClient.create",
    );
    expect(callable("notes.create_client").id).toBe(
      "notes.client.create_client",
    );
    // It does not re-export these, so they keep the path of their module.
    expect(callable("notes.client.run_all").id).toBe("notes.client.run_all");
    expect(callable("notes.sharing.SharingClient.share").id).toBe(
      "notes.sharing.SharingClient.share",
    );
  });

  test("files a function under the package of its name", () => {
    expect(new Set(callables(model).map((symbol) => symbol.module))).toEqual(
      new Set(["notes"]),
    );
  });

  test("hands over the public functions, and no other", () => {
    expect(
      callables(model)
        .map((symbol) => symbol.name)
        .sort(),
    ).toEqual([
      "notes.AsyncNotesClient.archive",
      "notes.AsyncNotesClient.create",
      "notes.AsyncNotesClient.delete",
      "notes.NotesClient.in_folder",
      "notes.NotesClient.move",
      "notes.NotesClient.search",
      "notes.NotesClient.version",
      "notes.SyncNotesClient.archive",
      "notes.SyncNotesClient.create",
      "notes.SyncNotesClient.delete",
      "notes.client.run_all",
      "notes.create_client",
      "notes.history.HistoryClient.versions",
      "notes.sharing.SharingClient.send_link",
      "notes.sharing.SharingClient.share",
    ]);
    // In a private module, and nothing re-exports it.
    expect(at("notes._io.handle_http_io")).toBeUndefined();
    // Written by `@dataclass`, so it has no docstring and no place for one.
    expect(at("notes.types.Folder.__init__")).toBeUndefined();
  });

  test("keeps one symbol for a function, however many names lead to it", () => {
    expect(at("notes.SyncNotesClient")).toBeUndefined();
    expect(new Set(model.symbols.map((symbol) => symbol.id)).size).toBe(
      model.symbols.length,
    );
  });

  test("renders a signature without the receiver, with its markers", () => {
    expect(callable("notes.SyncNotesClient.create").signature).toBe(
      "def create(title: str, body: str = '', options: CreateOptions | None = None, *tags: str, channel: Literal['email', 'sms'] = 'email', **metadata: str) -> Note",
    );
    expect(callable("notes.SyncNotesClient.delete").signature).toBe(
      "def delete(note_id: str, /) -> None",
    );
    expect(callable("notes.NotesClient.in_folder").signature).toBe(
      "def in_folder(folder: Folder) -> Self",
    );
  });

  test("keeps every parameter of a static method and a function", () => {
    expect(callable("notes.NotesClient.version").signature).toBe(
      "def version() -> str",
    );
    expect(
      callable("notes.create_client").parameters.map(
        (parameter) => parameter.name,
      ),
    ).toEqual(["url", "is_async", "timeout"]);
  });

  test("marks an async method in its signature", () => {
    expect(callable("notes.AsyncNotesClient.delete").signature).toBe(
      "async def delete(note_id: str, /) -> None",
    );
  });

  test("renders PEP 695 type parameters and lists their names", () => {
    const createClient = callable("notes.create_client");
    expect(createClient.signature).toBe(
      "def create_client[Client: NotesClient](url: str, *, is_async: bool = False, timeout: float | None = None) -> NotesClient",
    );
    expect(createClient.typeParams).toEqual(["Client"]);
  });

  test("describes each parameter: default, variadic, allowed values", () => {
    expect(callable("notes.SyncNotesClient.create").parameters).toEqual([
      {
        name: "title",
        type: { text: "str" },
        required: true,
        variadic: false,
        description: "The title of the note.",
      },
      {
        name: "body",
        type: { text: "str" },
        required: false,
        default: "",
        variadic: false,
        description: "The text of the note. It may be empty.",
      },
      {
        name: "options",
        type: {
          text: "CreateOptions | None",
          ref: "notes.types.CreateOptions",
        },
        required: false,
        default: "None",
        variadic: false,
        description: "How the note is created.",
      },
      {
        name: "tags",
        type: { text: "str" },
        required: false,
        variadic: true,
        description: "Tags to attach to the note.",
      },
      {
        name: "channel",
        type: { text: "Literal['email', 'sms']" },
        required: false,
        default: "email",
        variadic: false,
        allowedValues: ["email", "sms"],
        description: "Who is told about the note.",
      },
      {
        name: "metadata",
        type: { text: "str" },
        required: false,
        variadic: true,
        description: "Anything else to store with the note.",
      },
    ]);
  });

  test("reads Google docstrings as griffe parsed them", () => {
    const create = callable("notes.SyncNotesClient.create").doc;
    expect(create.summary).toBe("Creates a note with a title and a body.");
    expect(create.description).toBe(
      'Creates a note with a title and a body.\n\nThe note is stored at once.\n\n```python\nnote = client.create("Hello", "World")\n```',
    );
    expect(create.returns).toBe("The stored note.");
    expect(create.throws).toEqual([
      { type: "NotesError", description: "If the service rejects the note." },
    ]);

    const remove = callable("notes.SyncNotesClient.delete");
    expect(remove.parameters[0]?.description).toBe(
      "The id of the note to delete.",
    );
    expect(remove.doc.throws).toEqual([
      { type: "NotesError", description: "If there is no such note." },
    ]);
  });

  test("takes examples from the Examples section only, titled by the paragraph above each", () => {
    // A code block in the text is part of the description, not an example.
    expect(callable("notes.SyncNotesClient.create").doc.examples).toEqual([]);
    expect(
      callable("notes.history.HistoryClient.versions").doc.examples,
    ).toEqual([
      {
        title: "Print the titles of the last two versions",
        lang: "python",
        code: '>>> for version in client.versions("note-1", limit=2):\n...     print(version.title)\nHello\nHello, world',
      },
      {
        title: "Only the versions Ada saved",
        lang: "python",
        code: 'versions = list(client.versions("note-1", editor="ada@example.com"))',
      },
    ]);
    expect(callable("notes.NotesClient.search").doc.examples).toEqual([
      {
        title: "Find the notes about Python",
        lang: "python",
        code: '>>> client.search(SearchOptions(query="python"))',
      },
    ]);
  });

  test("sees through a wrapper return type and adds the awaitable form", () => {
    const search = callable("notes.NotesClient.search");
    expect(search.signature).toBe(
      "def search(options: SearchOptions, *, page: int = 1) -> list[Note]",
    );
    expect(search.alternateSignatures).toEqual([
      "async def search(options: SearchOptions, *, page: int = 1) -> list[Note]",
    ]);
    expect(search.returns).toEqual({ text: "list[Note]" });
  });

  test("keeps a wrapper return type that the config does not name", () => {
    const search = callable("notes.NotesClient.search", griffeModel(dump));
    expect(search.signature).toBe(
      "def search(options: SearchOptions, *, page: int = 1) -> HttpMethod[list[Note]]",
    );
    expect(search.alternateSignatures).toEqual([]);
  });

  test("has no return type for a function that returns None", () => {
    expect(callable("notes.SyncNotesClient.delete").returns).toBeUndefined();
  });

  test("documents a class under its access path when the config gives one", () => {
    expect(callable("notes.SyncNotesClient.create").symbol).toBe(
      "client.create",
    );
    expect(callable("notes.AsyncNotesClient.create").symbol).toBe(
      "notes.AsyncNotesClient.create",
    );
    expect(callable("notes.create_client").symbol).toBe("notes.create_client");
  });

  test("lists the fields of a dataclass, inherited ones first, in source order", () => {
    // `_retries` is private, `version` a ClassVar, `is_tagged` a property.
    expect(propertyTitles("notes.types.CreateOptions")).toEqual([
      "timeout",
      "tags",
      "folder",
    ]);
    expect(propertyTitles("notes.types.Folder")).toEqual(["name", "parent"]);
  });

  test("lists the fields of a pydantic model, found through its import", () => {
    expect(propertyTitles("notes.types.SearchOptions")).toEqual([
      "query",
      "limit",
      "order",
    ]);
  });

  test("finds inherited fields through a generic base class", () => {
    expect(propertyTitles("notes.types.NoteEnvelope")).toEqual([
      "data",
      "cursor",
    ]);
  });

  test("describes an attribute without an annotation without a type", () => {
    expect(at("notes.client.NotesClient.default_folder")).toEqual({
      id: "notes.client.NotesClient.default_folder",
      position: expect.any(Object),
      kind: "property",
      title: "default_folder",
      required: false,
      description: "",
    });
  });

  test("resolves a type named through a module, and a union with None first", () => {
    const move = callable("notes.NotesClient.move");
    expect(move.signature).toBe(
      "def move(note_id: str, /, folder: types.Folder, priority: float | int = 0, *, strict: Literal[True] = True, owner: None | Folder = None, context=None) -> None",
    );
    const types = Object.fromEntries(
      move.parameters.map((parameter) => [parameter.name, parameter.type]),
    );
    expect(types).toEqual({
      note_id: { text: "str" },
      folder: { text: "types.Folder", ref: "notes.types.Folder" },
      // A union of two types is not one type to inline.
      priority: { text: "float | int" },
      strict: { text: "Literal[True]" },
      owner: { text: "None | Folder", ref: "notes.types.Folder" },
      context: undefined,
    });
    expect(move.parameters[3]?.allowedValues).toEqual([true]);
  });

  test("renders variadic type parameters", () => {
    const runAll = callable("notes.client.run_all");
    expect(runAll.signature).toBe(
      "def run_all[*Ts, **P](callback: Callable[P, None], *values: *Ts) -> None",
    );
    expect(runAll.typeParams).toEqual(["Ts", "P"]);
  });

  test("describes a field: required without a default, docstring on one line", () => {
    expect(at("notes.types.CreateOptions.folder")).toEqual({
      id: "notes.types.CreateOptions.folder",
      // Relative to the package, so the same on every machine.
      position: {
        file: "notes/types.py",
        line: expect.any(Number),
        column: 0,
      },
      kind: "property",
      title: "folder",
      type: { text: "Folder | None", ref: "notes.types.Folder" },
      required: false,
      description:
        "Where the note is filed. When `None`, the note goes to the inbox.",
    });
    expect(at("notes.types.Folder.name")).toMatchObject({ required: true });
  });

  test("resolves a string annotation that names its own class", () => {
    expect(at("notes.types.Folder.parent")).toMatchObject({
      type: { text: "Folder | None", ref: "notes.types.Folder" },
    });
  });

  test("does not inline a class without fields, or a type inside a generic", () => {
    expect(at("notes.types.NotesError")).toBeUndefined();
    expect(at("notes.client.NotesClient")).toBeUndefined();
    // `list[Note]` is not `Note`.
    expect(callable("notes.NotesClient.search").returns?.ref).toBeUndefined();
    expect(callable("notes.SyncNotesClient.archive").returns).toEqual({
      text: "Note",
      ref: "notes.types.Note",
    });
  });

  test("reads a deprecation and its message from the decorator", () => {
    expect(
      callable("notes.sharing.SharingClient.send_link").deprecated,
    ).toEqual({
      message: "Use share() instead.",
    });
    expect(
      callable("notes.sharing.SharingClient.share").deprecated,
    ).toBeUndefined();
  });

  test("matches a variadic parameter that the docstring writes with its star", () => {
    expect(
      callable("notes.sharing.SharingClient.share").parameters[1],
    ).toMatchObject({
      name: "people",
      variadic: true,
      description: "The email addresses of the people to share the note with.",
    });
  });

  test("keeps a Warning section in the description, as a quote", () => {
    expect(
      callable("notes.sharing.SharingClient.share").doc.description,
    ).toEndWith(
      "\n\n> **Warning:** Anyone who has the link can read the note.",
    );
  });

  test("marks nothing deprecated or unstable that is not", () => {
    const create = callable("notes.SyncNotesClient.create");
    expect(create.stability).toBe("stable");
    expect(create.deprecated).toBeUndefined();
  });

  test("gives the same model whatever order the dump lists things in", () => {
    const reverseKeys = (value: unknown): unknown => {
      if (Array.isArray(value)) {
        return value.map(reverseKeys);
      }
      if (typeof value !== "object" || value === null) {
        return value;
      }
      return Object.fromEntries(
        Object.entries(value)
          .toReversed()
          .map(([key, inner]) => [key, reverseKeys(inner)]),
      );
    };
    expect(griffeModel(reverseKeys(dump) as GriffeDump, options)).toEqual(
      model,
    );
  });
});

describe("which functions are public, and under which name", () => {
  /** An object of a dump, written out only as far as a test needs it. */
  interface Member {
    readonly name: string;
    readonly [field: string]: unknown;
  }

  const last = (path: string): string => path.slice(path.lastIndexOf(".") + 1);

  /** A documented function, defined at `path`. */
  const fn = (path: string, fields: object = {}): Member => ({
    kind: "function",
    name: last(path),
    path,
    is_public: true,
    parameters: [],
    returns: null,
    docstring: { value: "Does it." },
    ...fields,
  });

  const group =
    (kind: "module" | "class") =>
    (path: string, members: Member[], fields: object = {}): Member => ({
      kind,
      name: last(path),
      path,
      is_public: true,
      members: Object.fromEntries(
        members.map((member) => [member.name, member]),
      ),
      ...fields,
    });
  const module = group("module");
  const cls = group("class");

  /** `from <target> import <name>` in the module `path` is in. */
  const alias = (path: string, target: string): Member => ({
    kind: "alias",
    name: last(path),
    path,
    target_path: target,
    is_public: true,
  });

  const PRIVATE = { is_public: false };

  const modelOf = (roots: Member[], symbolPaths?: Record<string, string>) =>
    griffeModel(
      Object.fromEntries(
        roots.map((root) => [root.name, root]),
      ) as unknown as GriffeDump,
      symbolPaths === undefined ? {} : { symbolPaths },
    );

  const names = (...roots: Member[]): string[] =>
    callables(modelOf(roots))
      .map((symbol) => symbol.name)
      .sort();

  test("a class in a private module is public when its package re-exports it", () => {
    expect(
      names(
        module("pkg", [
          module(
            "pkg._impl",
            [
              cls("pkg._impl.Client", [fn("pkg._impl.Client.send")]),
              fn("pkg._impl.helper"),
            ],
            PRIVATE,
          ),
          alias("pkg.Client", "pkg._impl.Client"),
        ]),
      ),
    ).toEqual(["pkg.Client.send"]);
  });

  test("takes griffe's word for what a module or a class exposes", () => {
    // Not in `__all__`, an underscore name, or a plain import.
    expect(
      names(
        module("pkg", [
          fn("pkg.hidden", PRIVATE),
          cls("pkg._Session", [fn("pkg._Session.refresh")], PRIVATE),
          cls("pkg.Client", [fn("pkg.Client._send", PRIVATE)]),
        ]),
      ),
    ).toEqual([]);
  });

  test("names a function by its shortest import path, then the first in the alphabet", () => {
    expect(
      names(
        module("pkg", [
          module("pkg.deep", [
            module("pkg.deep.tools", [fn("pkg.deep.tools.run")]),
          ]),
          alias("pkg.start", "pkg.deep.tools.run"),
          alias("pkg.go", "pkg.deep.tools.run"),
        ]),
      ),
    ).toEqual(["pkg.go"]);
  });

  test("keeps the name in the package that defines a function, whoever else re-exports it", () => {
    const core = module("core", [module("core.jobs", [fn("core.jobs.run")])]);
    const app = module("app", [alias("app.run", "core.jobs.run")]);
    // `app.run` is shorter and earlier in the alphabet, and still loses.
    expect(names(app, core)).toEqual(["core.jobs.run"]);
  });

  test("names a function after another package when only that one exposes it", () => {
    const core = module("core", [
      module("core._jobs", [fn("core._jobs.run")], PRIVATE),
    ]);
    const app = module("app", [alias("app.run", "core._jobs.run")]);
    const [run] = callables(modelOf([app, core]));
    expect(run).toMatchObject({
      id: "core._jobs.run",
      name: "app.run",
      module: "app",
      symbol: "app.run",
    });
  });

  test("hands over an `__init__` written by hand, and another special method only with a docstring", () => {
    const special = { is_special: true, docstring: undefined };
    expect(
      names(
        module("pkg", [
          cls("pkg.Client", [
            fn("pkg.Client.__init__", { ...special, lineno: 12 }),
            fn("pkg.Client.__enter__", { ...special, lineno: 20 }),
            fn("pkg.Client.__repr__", {
              ...special,
              lineno: 24,
              docstring: { value: "Shows the URL." },
            }),
            fn("pkg.Client.send", { docstring: undefined }),
          ]),
          // `@dataclass` writes the `__init__`, without a source line.
          cls("pkg.Options", [fn("pkg.Options.__init__", special)]),
        ]),
      ),
    ).toEqual([
      "pkg.Client.__init__",
      "pkg.Client.__repr__",
      "pkg.Client.send",
    ]);
  });

  test("survives a module that exposes the package it is in", () => {
    expect(
      names(
        module("pkg", [
          module("pkg.sub", [alias("pkg.sub.up", "pkg"), fn("pkg.sub.run")]),
        ]),
      ),
    ).toEqual(["pkg.sub.run"]);
  });

  test("ignores an import of something that is not in the dump", () => {
    expect(names(module("pkg", [alias("pkg.Client", "httpx.Client")]))).toEqual(
      [],
    );
  });

  test("changes the symbol of a class's methods, and not their name", () => {
    const pkg = module("pkg", [cls("pkg.Client", [fn("pkg.Client.send")])]);
    const [send] = callables(modelOf([pkg], { "pkg.Client": "app.client" }));
    expect(send).toMatchObject({
      name: "pkg.Client.send",
      symbol: "app.client.send",
    });
  });

  test("rejects a symbol path for what is not a class of the API", () => {
    const pkg = module("pkg", [
      cls("pkg.Client", [fn("pkg.Client.send")]),
      cls("pkg.Empty", []),
    ]);
    expect(() =>
      modelOf([pkg], {
        "pkg.Gone": "gone",
        "pkg.Client": "client",
        // Not the import path, and a class without methods.
        Client: "client",
        "pkg.Empty": "empty",
      }),
    ).toThrow(
      new GeneratorError(
        "symbolPaths names what is not the import path of a class with public methods:",
        ["Client", "pkg.Empty", "pkg.Gone"],
      ),
    );
  });
});

describe("a dump that is unusual but valid", () => {
  const module = (members: Record<string, object>): GriffeDump =>
    ({
      pkg: { kind: "module", name: "pkg", path: "pkg", members },
    }) as unknown as GriffeDump;

  const send = (fields: object): object => ({
    kind: "function",
    name: "send",
    path: "pkg.send",
    is_public: true,
    parameters: [],
    returns: null,
    ...fields,
  });

  test("survives imports that point at each other", () => {
    const cyclic = griffeModel(
      module({
        A: {
          kind: "alias",
          name: "A",
          path: "pkg.A",
          target_path: "pkg.B",
          is_public: true,
        },
        B: {
          kind: "alias",
          name: "B",
          path: "pkg.B",
          target_path: "pkg.A",
          is_public: true,
        },
        send: send({ returns: { cls: "ExprName", name: "A" } }),
      }),
    );
    // Neither import leads to anything, as a type or as a public name.
    expect(callables(cyclic).map((symbol) => symbol.name)).toEqual([
      "pkg.send",
    ]);
    expect(callable("pkg.send", cyclic).returns).toEqual({ text: "A" });
  });

  test("reads a raised error without a type, and an unnamed return", () => {
    const documented = griffeModel(
      module({
        send: send({
          returns: "'Sent'",
          docstring: {
            value: "Sends it.",
            parsed: [
              { kind: "text", value: "Sends it." },
              {
                kind: "returns",
                value: [{ description: "" }, { description: "A receipt." }],
              },
              {
                kind: "raises",
                value: [{ annotation: null, description: "When\noffline." }],
              },
              { kind: "parameters", value: [{ description: "No name." }] },
            ],
          },
        }),
      }),
    );
    const doc = callable("pkg.send", documented).doc;
    expect(doc.returns).toBe("A receipt.");
    expect(doc.throws).toEqual([{ description: "When offline." }]);
  });

  test("knows the deprecated decorator however it was imported", () => {
    const decorated = (decorator: object, imports: Record<string, object>) =>
      callable(
        "pkg.send",
        griffeModel(
          module({
            ...imports,
            send: send({ decorators: [{ value: decorator }] }),
          }),
        ),
      ).deprecated;
    const alias = (name: string, target: string) => ({
      [name]: { kind: "alias", name, path: `pkg.${name}`, target_path: target },
    });
    const call = (fn: object, ...args: unknown[]) => ({
      cls: "ExprCall",
      function: fn,
      arguments: args,
    });
    const name = (text: string) => ({ cls: "ExprName", name: text });

    // from typing_extensions import deprecated as gone
    expect(
      decorated(
        call(name("gone"), "'Use post().'"),
        alias("gone", "typing_extensions.deprecated"),
      ),
    ).toEqual({ message: "Use post()." });
    // import warnings; @warnings.deprecated("...")
    expect(
      decorated(
        call(
          {
            cls: "ExprAttribute",
            values: [name("warnings"), name("deprecated")],
          },
          '"Use post()."',
        ),
        alias("warnings", "warnings"),
      ),
    ).toEqual({ message: "Use post()." });
    // A message that is not a plain string, and no arguments at all.
    expect(
      decorated(
        call(name("deprecated"), name("MESSAGE")),
        alias("deprecated", "warnings.deprecated"),
      ),
    ).toEqual({});
    expect(
      decorated(name("deprecated"), alias("deprecated", "warnings.deprecated")),
    ).toEqual({});
    // Another decorator with the same name is not it.
    expect(
      decorated(
        call(name("deprecated"), "'x'"),
        alias("deprecated", "mylib.deprecated"),
      ),
    ).toBeUndefined();
    expect(decorated(call(name("cache")), {})).toBeUndefined();
  });

  test("marks what griffe flags as deprecated, without a message", () => {
    const flagged = griffeModel(
      module({ send: send({ is_deprecated: true }) }),
    );
    expect(callable("pkg.send", flagged).deprecated).toEqual({});
  });

  test("has no return type for a function without a return annotation", () => {
    const plain = callable("pkg.send", griffeModel(module({ send: send({}) })));
    expect(plain.signature).toBe("def send()");
    expect(plain.returns).toBeUndefined();
  });
});

describe("a dump made without --docstyle", () => {
  test("still gives a summary and a description", () => {
    const stripParsed = (value: unknown): unknown => {
      if (Array.isArray(value)) {
        return value.map(stripParsed);
      }
      if (typeof value !== "object" || value === null) {
        return value;
      }
      return Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => key !== "parsed")
          .map(([key, inner]) => [key, stripParsed(inner)]),
      );
    };
    const plain = griffeModel(stripParsed(dump) as GriffeDump, options);
    const remove = callable("notes.SyncNotesClient.delete", plain);
    expect(remove.doc.summary).toBe("Deletes a note.");
    expect(remove.parameters[0]?.description).toBe("");
  });
});

describe("parseGriffeDump", () => {
  test("rejects JSON that is not a griffe dump, naming the file", () => {
    for (const json of [
      null,
      [],
      {},
      { notes: {} },
      { notes: { kind: "class" } },
    ]) {
      expect(() => parseGriffeDump(json, "api.json")).toThrow(
        new GeneratorError("api.json is not a griffe dump."),
      );
    }
  });

  test("rejects a dump that does not say what is public", () => {
    // What `griffe dump` writes without `--full`.
    const brief = { notes: { kind: "module", name: "notes", members: {} } };
    expect(() => parseGriffeDump(brief, "api.json")).toThrow(
      new GeneratorError(
        "api.json does not say what is public. Write it with `griffe dump --full`.",
      ),
    );
    const full = { notes: { ...brief.notes, path: "notes", is_public: true } };
    expect(parseGriffeDump(full, "api.json")).toBe(full as never);
  });
});

describe("readGriffeDump", () => {
  test("fails with a message when the file does not exist", () => {
    expect(() =>
      readGriffeDump(join(pythonFixture.directory, "missing.json")),
    ).toThrow(/^Cannot read the griffe dump: /);
  });
});
