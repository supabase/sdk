import { describe, expect, test } from "bun:test";
import { parse } from "yaml";
import {
  type ApiDoc,
  type ApiModel,
  type ApiSymbol,
  type CallableSymbol,
  type Definition,
  generate,
  type GenerateInput,
  GeneratorError,
} from "../src/index.ts";

let line = 0;

/**
 * A documented function. `name` is what its definition id is made from, and
 * what tells it from other functions: two callables of one name are overloads.
 */
const callable = (
  name: string,
  fields: Partial<CallableSymbol> = {},
): CallableSymbol => ({
  id: `${name}#${++line}`,
  name,
  module: "Module",
  kind: "callable",
  position: { file: "Client.swift", line, column: 0 },
  title: name.split(".").at(-1) ?? name,
  symbol: `Module.${name}`,
  signature: `func ${name}()`,
  alternateSignatures: [],
  doc: {
    summary: "Does it.",
    description: "Does it.",
    throws: [],
    examples: [],
  },
  parameters: [],
  typeParams: [],
  stability: "stable",
  ...fields,
});

const NO_DOC: ApiDoc = {
  summary: "",
  description: "",
  throws: [],
  examples: [],
};

const model = (...symbols: ApiSymbol[]): ApiModel => ({
  language: "swift",
  symbols,
});

/** The one definition a run wrote: its frontmatter and its notes. */
const only = (
  input: GenerateInput,
): { definition: Definition; notes: string } => {
  const { files } = generate(input);
  expect(files).toHaveLength(1);
  const content = files[0]?.content ?? "";
  const end = content.indexOf("\n---\n", 4);
  return {
    definition: parse(content.slice(4, end + 1)) as Definition,
    notes: content.slice(end + 5).trim(),
  };
};

const problemsOf = (input: GenerateInput): readonly string[] => {
  try {
    generate(input);
  } catch (error) {
    if (error instanceof GeneratorError) {
      return error.problems;
    }
    throw error;
  }
  return [];
};

describe("which functions get a definition", () => {
  test("every function, in a file named after it, sorted by name", () => {
    expect(
      generate({
        model: model(
          callable("makeClient"),
          callable("Client.signUp"),
          callable("Client.b"),
        ),
      }),
    ).toMatchObject({
      files: [
        { name: "client-b.md" },
        { name: "client-sign-up.md" },
        { name: "make-client.md" },
      ],
      undocumented: [],
      excluded: [],
    });
  });

  test("a function without a doc comment gets one too, and is reported", () => {
    expect(
      generate({
        model: model(
          callable("Client.b", { doc: NO_DOC }),
          callable("Client.a", { doc: NO_DOC }),
        ),
      }),
    ).toMatchObject({
      files: [{ name: "client-a.md" }, { name: "client-b.md" }],
      undocumented: ["Client.a", "Client.b"],
      excluded: [],
    });
  });

  test("a function without a doc comment has an empty summary and no description", () => {
    const { definition } = only({
      model: model(
        callable("Client.a", { doc: NO_DOC, returns: { text: "Session" } }),
      ),
    });
    expect(definition).toMatchObject({
      id: "client-a",
      summary: "",
      signature: "func Client.a()",
      returns: { type: "Session" },
    });
    expect(definition).not.toHaveProperty("description");
  });

  test("a model without functions gives nothing", () => {
    expect(generate({ model: model() })).toEqual({
      files: [],
      undocumented: [],
      excluded: [],
    });
  });
});

describe("exclude", () => {
  const names = (input: GenerateInput) => {
    const { files, undocumented, excluded } = generate(input);
    return { files: files.map((file) => file.name), undocumented, excluded };
  };

  test("leaves out the functions whose name matches a pattern", () => {
    expect(
      names({
        model: model(
          callable("Options.init"),
          callable("Client.b"),
          callable("Client.a"),
        ),
        exclude: ["\\.init$", "^Client\\.b$"],
      }),
    ).toEqual({
      files: ["client-a.md"],
      undocumented: [],
      excluded: ["Client.b", "Options.init"],
    });
  });

  test("matches anywhere in the name, unless the pattern is anchored", () => {
    const input = {
      model: model(callable("AsyncClient.a"), callable("Client.a")),
    };
    expect(names({ ...input, exclude: ["Client"] }).files).toEqual([]);
    expect(names({ ...input, exclude: ["^Client"] }).files).toEqual([
      "async-client-a.md",
    ]);
  });

  test("leaves out every overload, and counts the function once", () => {
    expect(
      names({
        model: model(callable("Client.a"), callable("Client.a")),
        exclude: ["^Client\\.a$"],
      }),
    ).toEqual({ files: [], undocumented: [], excluded: ["Client.a"] });
  });

  test("comes before the doc comment: what is excluded is not undocumented", () => {
    expect(
      names({
        model: model(callable("Options.init", { doc: NO_DOC })),
        exclude: ["\\.init$"],
      }),
    ).toEqual({ files: [], undocumented: [], excluded: ["Options.init"] });
  });

  test("rejects a pattern that matches no function", () => {
    expect(
      problemsOf({
        model: model(callable("Client.a")),
        exclude: ["^Client\\.a$", "^Gone\\.", "\\.renamed$"],
      }),
    ).toEqual([
      "exclude: \\.renamed$ matches no function",
      "exclude: ^Gone\\. matches no function",
    ]);
  });

  test("accepts two patterns that match the same function", () => {
    expect(
      names({
        model: model(callable("Options.init")),
        exclude: ["\\.init$", "^Options\\."],
      }).excluded,
    ).toEqual(["Options.init"]);
  });
});

describe("strict", () => {
  const HEADLINE =
    "Cannot generate the definitions. `strict` is on: give every function a doc comment, or leave it out with `exclude`:";

  const messageOf = (input: GenerateInput): string => {
    try {
      generate(input);
    } catch (error) {
      if (error instanceof GeneratorError) {
        return error.message;
      }
      throw error;
    }
    return "";
  };

  test("makes every function without a doc comment an error, and says how to fix it", () => {
    const input = {
      model: model(
        callable("Client.c", { doc: NO_DOC }),
        callable("Client.b"),
        callable("Client.a", { doc: NO_DOC }),
      ),
      strict: true,
    };
    expect(messageOf(input)).toBe(
      `${HEADLINE}\n  - Client.a has no doc comment\n  - Client.c has no doc comment`,
    );
    // Off, and when it is not set, the same functions get a definition and
    // are reported.
    for (const lenient of [
      { ...input, strict: false },
      { model: input.model },
    ]) {
      expect(generate(lenient)).toMatchObject({
        files: [
          { name: "client-a.md" },
          { name: "client-b.md" },
          { name: "client-c.md" },
        ],
        undocumented: ["Client.a", "Client.c"],
      });
    }
  });

  test("changes nothing when every function has a doc comment", () => {
    const documented = model(callable("Client.a"), callable("Client.b"));
    expect(generate({ model: documented, strict: true })).toEqual(
      generate({ model: documented }),
    );
  });

  test("is satisfied by one documented overload", () => {
    expect(
      generate({
        model: model(
          callable("Client.a", { doc: NO_DOC }),
          callable("Client.a"),
        ),
        strict: true,
      }).undocumented,
    ).toEqual([]);
  });

  test("does not ask for a doc comment on what `exclude` leaves out", () => {
    expect(
      generate({
        model: model(
          callable("Client.a"),
          callable("Options.init", { doc: NO_DOC }),
        ),
        exclude: ["\\.init$"],
        strict: true,
      }),
    ).toMatchObject({
      files: [{ name: "client-a.md" }],
      undocumented: [],
      excluded: ["Options.init"],
    });
  });

  test("lists the missing doc comments with every other problem", () => {
    const input = {
      model: model(
        callable("Client.signUp"),
        callable("Client.sign_up"),
        callable("Client.a", { doc: NO_DOC }),
      ),
      exclude: ["^Gone$"],
      strict: true,
    };
    expect(problemsOf(input)).toEqual([
      "Client.a has no doc comment",
      'Client.signUp and Client.sign_up both give the id "client-sign-up"',
      "exclude: ^Gone$ matches no function",
    ]);
    expect(messageOf(input)).toStartWith(`${HEADLINE}\n`);
  });

  test("keeps the plain message for problems that are not about doc comments", () => {
    expect(
      messageOf({
        model: model(callable("Client.a")),
        exclude: ["^Gone$"],
        strict: true,
      }),
    ).toBe(
      "Cannot generate the definitions:\n  - exclude: ^Gone$ matches no function",
    );
  });
});

describe("overloads", () => {
  const at = (id: string, file: string, lineNumber: number, doc?: ApiDoc) =>
    callable("Client.a", {
      id,
      signature: id,
      position: { file, line: lineNumber, column: 0 },
      ...(doc === undefined ? {} : { doc }),
    });

  test("share one definition, which documents the first in source order", () => {
    const { definition, notes } = only({
      // Listed last, declared first.
      model: model(
        at("third", "B.swift", 1),
        at("second", "A.swift", 9),
        at("first", "A.swift", 2),
      ),
    });
    expect(definition.id).toBe("client-a");
    expect(definition.signature).toBe("first");
    expect(notes).toBe("Other signatures:\n\n```swift\nsecond\nthird\n```");
  });

  test("the first one with a doc comment leads, and the others are still listed", () => {
    const { definition, notes } = only({
      model: model(
        at("first", "A.swift", 2, NO_DOC),
        at("second", "A.swift", 9),
        at("third", "B.swift", 1, NO_DOC),
      ),
    });
    expect(definition.signature).toBe("second");
    expect(notes).toBe("Other signatures:\n\n```swift\nfirst\nthird\n```");
  });

  test("are undocumented only when none of them has a doc comment, and then the first leads", () => {
    const input = {
      model: model(
        at("second", "A.swift", 9, NO_DOC),
        at("first", "A.swift", 2, NO_DOC),
      ),
    };
    expect(generate(input).undocumented).toEqual(["Client.a"]);
    const { definition, notes } = only(input);
    expect(definition.signature).toBe("first");
    expect(notes).toBe("Other signatures:\n\n```swift\nsecond\n```");
  });

  test("are told from another function by the name alone", () => {
    const { files } = generate({
      model: model(
        callable("SyncClient.send"),
        callable("AsyncClient.send"),
        callable("SyncClient.dispatch"),
      ),
    });
    expect(files.map((file) => file.name)).toEqual([
      "async-client-send.md",
      "sync-client-dispatch.md",
      "sync-client-send.md",
    ]);
    for (const file of files) {
      expect(file.content).not.toContain("Other signatures");
    }
  });
});

describe("notes", () => {
  test("list the other overloads and the alternate forms of each", () => {
    const { notes } = only({
      model: model(
        callable("Client.send", { signature: "def send()" }),
        callable("Client.send", {
          signature: "def send(retries)",
          alternateSignatures: ["async def send(retries)"],
        }),
      ),
    });
    expect(notes).toBe(
      "Other signatures:\n\n```swift\ndef send(retries)\nasync def send(retries)\n```",
    );
  });

  test("list the lead's own alternate forms, each signature once", () => {
    const { notes } = only({
      model: model(
        callable("Client.send", {
          signature: "def send()",
          alternateSignatures: ["async def send()", "def send()"],
        }),
        callable("Client.send", {
          signature: "async def send()",
        }),
      ),
    });
    expect(notes).toBe("Other signatures:\n\n```swift\nasync def send()\n```");
  });

  test("carry the deprecation message on one line", () => {
    const { definition, notes } = only({
      model: model(
        callable("Client.a", {
          deprecated: { message: "Use b() instead.\n  See the guide." },
        }),
      ),
    });
    expect(definition.deprecated).toBe(true);
    expect(notes).toBe("> **Deprecated:** Use b() instead. See the guide.");
  });

  test("are empty for a deprecation without a message", () => {
    const { definition, notes } = only({
      model: model(callable("Client.a", { deprecated: {} })),
    });
    expect(definition.deprecated).toBe(true);
    expect(notes).toBe("");
  });
});

describe("the definition", () => {
  test("takes its id from its name and its category from its module", () => {
    const { definition } = only({
      model: model(callable("AuthClient.signUp", { module: "Auth" })),
    });
    expect(definition).toEqual({
      id: "auth-client-sign-up",
      kind: "method",
      category: "Auth",
      title: "signUp",
      symbol: "Module.AuthClient.signUp",
      summary: "Does it.",
      description: "Does it.",
      signature: "func AuthClient.signUp()",
      stability: "stable",
      deprecated: false,
      parameters: [],
      throws: [],
      examples: [],
    });
  });

  test("leaves out what is empty and keeps what is set", () => {
    const { definition } = only({
      model: model(
        callable("Client.a", {
          typeParams: ["T"],
          stability: "experimental",
          returns: { text: "Session" },
          doc: {
            summary: "S.",
            description: "S.\n\nMore.",
            returns: "The session.",
            throws: [
              { type: "AuthError", description: "On failure." },
              { description: "Otherwise." },
            ],
            examples: [],
          },
          parameters: [
            { name: "plain", required: true, variadic: false, description: "" },
            {
              name: "full",
              type: { text: "Mode" },
              required: false,
              default: "fast",
              variadic: true,
              allowedValues: ["fast", "slow"],
              description: "How.",
            },
          ],
        }),
      ),
    });
    expect(definition.type_params).toEqual(["T"]);
    expect(definition.stability).toBe("experimental");
    expect(definition.description).toBe("S.\n\nMore.");
    expect(definition.returns).toEqual({
      type: "Session",
      description: "The session.",
    });
    expect(definition.throws).toEqual([
      { type: "AuthError", description: "On failure." },
      { description: "Otherwise." },
    ]);
    expect(definition.parameters).toEqual([
      { name: "plain", location: "argument", required: true },
      {
        name: "full",
        location: "argument",
        type: "Mode",
        required: false,
        description: "How.",
        default: "fast",
        allowed_values: ["fast", "slow"],
        variadic: true,
      },
    ]);
  });

  test("has no `returns` when the callable returns nothing", () => {
    const { definition } = only({
      model: model(
        callable("Client.a", {
          doc: {
            summary: "S.",
            description: "S.",
            returns: "Nothing.",
            throws: [],
            examples: [],
          },
        }),
      ),
    });
    expect(definition.returns).toBeUndefined();
  });
});

describe("nested fields", () => {
  const property = (
    id: string,
    type: { text: string; ref?: string },
    description = "",
  ): ApiSymbol => ({
    id,
    kind: "property",
    position: { file: "Types.swift", line: ++line, column: 0 },
    title: id.split(".").at(-1) ?? id,
    type,
    required: !type.text.endsWith("?"),
    description,
  });
  const type = (id: string, properties: string[]): ApiSymbol => ({
    id,
    kind: "type",
    position: { file: "Types.swift", line: ++line, column: 0 },
    properties,
  });
  const taking = (ref: string | undefined) =>
    callable("Client.a", {
      parameters: [
        {
          name: "options",
          type:
            ref === undefined ? { text: "Options" } : { text: "Options", ref },
          required: true,
          variadic: false,
          description: "",
        },
      ],
    });

  test("inline the members of a type, all the way down", () => {
    const { definition } = only({
      model: model(
        taking("Options"),
        type("Options", ["Options.retry", "Options.name"]),
        property(
          "Options.retry",
          { text: "Retry?", ref: "Retry" },
          "When to retry.",
        ),
        property("Options.name", { text: "String" }),
        type("Retry", ["Retry.count"]),
        property("Retry.count", { text: "Int" }, "How often."),
      ),
    });
    expect(definition.parameters[0]?.children).toEqual([
      {
        name: "retry",
        location: "property",
        type: "Retry?",
        required: false,
        description: "When to retry.",
        children: [
          {
            name: "count",
            location: "property",
            type: "Int",
            required: true,
            description: "How often.",
          },
        ],
      },
      { name: "name", location: "property", type: "String", required: true },
    ]);
  });

  test("stop at a type that contains itself", () => {
    const { definition } = only({
      model: model(
        taking("Folder"),
        type("Folder", ["Folder.parent"]),
        property("Folder.parent", { text: "Folder?", ref: "Folder" }),
      ),
    });
    expect(definition.parameters[0]?.children).toEqual([
      {
        name: "parent",
        location: "property",
        type: "Folder?",
        required: false,
      },
    ]);
  });

  test("stop at two types that contain each other", () => {
    const { definition } = only({
      model: model(
        taking("A"),
        type("A", ["A.b"]),
        property("A.b", { text: "B", ref: "B" }),
        type("B", ["B.a"]),
        property("B.a", { text: "A", ref: "A" }),
      ),
    });
    expect(definition.parameters[0]?.children).toEqual([
      {
        name: "b",
        location: "property",
        type: "B",
        required: true,
        children: [
          { name: "a", location: "property", type: "A", required: true },
        ],
      },
    ]);
  });

  test("are absent for a type without a reference or without members", () => {
    for (const symbols of [
      [taking(undefined)],
      [taking("Options"), type("Options", [])],
      // A reference to what is not a type.
      [taking("Options"), property("Options", { text: "String" })],
      [taking("Missing")],
    ]) {
      const { definition } = only({
        model: model(...symbols),
      });
      expect(definition.parameters[0]).toEqual({
        name: "options",
        location: "argument",
        type: "Options",
        required: true,
      });
    }
  });
});

describe("examples", () => {
  const withExamples = (...examples: { title?: string; code: string }[]) =>
    only({
      model: model(
        callable("Client.a", {
          doc: {
            summary: "S.",
            description: "S.",
            throws: [],
            examples: examples.map((example) => ({
              lang: "swift",
              ...example,
            })),
          },
        }),
      ),
    }).definition.examples;

  test("are numbered when the source gives them no title", () => {
    expect(withExamples({ code: "a()" }, { code: "b()\n" })).toEqual([
      { id: "example-1", title: "Example 1", lang: "swift", code: "a()\n" },
      { id: "example-2", title: "Example 2", lang: "swift", code: "b()\n" },
    ]);
  });

  test("take their id from their title", () => {
    expect(
      withExamples({ title: "Sign up with an email", code: "a()" }),
    ).toEqual([
      {
        id: "sign-up-with-an-email",
        title: "Sign up with an email",
        lang: "swift",
        code: "a()\n",
      },
    ]);
  });

  test("get distinct ids when titles repeat or have no letters", () => {
    expect(
      withExamples(
        { title: "Basic", code: "a()" },
        { title: "Basic", code: "b()" },
        { title: "???", code: "c()" },
      ).map((example) => example.id),
    ).toEqual(["basic", "basic-2", "example-3"]);
  });

  test("end with exactly one line break", () => {
    expect(withExamples({ code: "a()\n\n\n" })[0]?.code).toBe("a()\n");
  });
});

describe("errors", () => {
  test("reject two functions that give one id, instead of overwriting", () => {
    expect(
      problemsOf({
        model: model(callable("Client.sign_up"), callable("Client.signUp")),
      }),
    ).toEqual([
      'Client.signUp and Client.sign_up both give the id "client-sign-up"',
    ]);
  });

  test("reject a name that gives no valid definition id", () => {
    expect(problemsOf({ model: model(callable("_")) })).toEqual([
      '_: "" is not a valid definition id',
    ]);
  });

  test("list every problem at once, sorted", () => {
    expect(
      problemsOf({
        model: model(
          callable("_"),
          callable("Client.signUp"),
          callable("Client.sign_up"),
        ),
        exclude: ["^Gone$"],
      }),
    ).toEqual([
      'Client.signUp and Client.sign_up both give the id "client-sign-up"',
      '_: "" is not a valid definition id',
      "exclude: ^Gone$ matches no function",
    ]);
  });

  test("give the same message whatever order the symbols are in", () => {
    const symbols = [
      callable("Client.signUp"),
      callable("Client.sign_up"),
      callable("Client.SignUp"),
    ];
    expect(problemsOf({ model: model(...symbols) })).toHaveLength(2);
    expect(problemsOf({ model: model(...symbols.toReversed()) })).toEqual(
      problemsOf({ model: model(...symbols) }),
    );
  });

  test("reject a model with two symbols under one id", () => {
    expect(
      problemsOf({
        model: model(
          callable("Client.a", { id: "same" }),
          callable("Client.b", { id: "same" }),
        ),
      }),
    ).toEqual(["same"]);
  });

  test("write nothing when there is a problem", () => {
    expect(() =>
      generate({
        model: model(callable("Client.a")),
        exclude: ["^Gone$"],
      }),
    ).toThrow(GeneratorError);
  });
});
