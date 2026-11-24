import { describe, expect, test } from "bun:test";
import {
  linkTarget,
  parseDocComment,
} from "../../src/sources/swift/doc-comment.ts";

/** Parses a doc comment written as one text, the way a `///` block reads. */
const parse = (text: string) => parseDocComment(text.split("\n"));

describe("parseDocComment", () => {
  test("splits a comment into summary, description and callouts", () => {
    const doc = parse(`Creates a user with an email address
and a password.

When confirmation is off, the user is signed in at once.

- Parameters:
  - email: The user's email address.
  - password: The user's password.
- Returns: The new session.
- Throws: \`\`AuthError\`\` when the request fails.`);
    expect(doc.summary).toBe(
      "Creates a user with an email address and a password.",
    );
    expect(doc.description).toBe(
      "Creates a user with an email address\nand a password.\n\nWhen confirmation is off, the user is signed in at once.",
    );
    expect([...doc.parameters]).toEqual([
      ["email", "The user's email address."],
      ["password", "The user's password."],
    ]);
    expect(doc.returns).toBe("The new session.");
    expect(doc.throws).toEqual([
      { type: "AuthError", description: "`AuthError` when the request fails." },
    ]);
    expect(doc.examples).toEqual([]);
  });

  test("reads the single-parameter form, with or without backticks", () => {
    const doc = parse(`Deletes a note.

- Parameter id: The note to delete.
- parameter \`force\`: Whether to skip the bin.`);
    expect([...doc.parameters]).toEqual([
      ["id", "The note to delete."],
      ["force", "Whether to skip the bin."],
    ]);
  });

  test("joins the continuation lines of a callout", () => {
    const doc = parse(`Sends it.

- Parameters:
  - options: The metadata and redirect URL. \`\`Options/channel\`\`
    does not apply to email.
  - other: Short.
- Returns: The session,
  or the user to confirm
and nothing else.
- Throws: An error.

  A second paragraph of the same callout.`);
    expect(doc.parameters.get("options")).toBe(
      "The metadata and redirect URL. `Options.channel` does not apply to email.",
    );
    expect(doc.parameters.get("other")).toBe("Short.");
    expect(doc.returns).toBe(
      "The session, or the user to confirm and nothing else.",
    );
    expect(doc.throws).toEqual([
      {
        description: "An error.\n\nA second paragraph of the same callout.",
      },
    ]);
  });

  test("skips what is not a parameter inside a parameters callout", () => {
    const doc = parse(`Summary.

- Parameters:
  These are the parameters.

  - first: One.

  - second: Two.`);
    expect([...doc.parameters]).toEqual([
      ["first", "One."],
      ["second", "Two."],
    ]);
    expect(doc.description).toBe("Summary.");
  });

  test("ends a callout at the next paragraph that is not indented", () => {
    const doc = parse(`Summary.

- Returns: A value.

Back in the description.`);
    expect(doc.returns).toBe("A value.");
    expect(doc.description).toBe("Summary.\n\nBack in the description.");
  });

  test("keeps other callouts and lists in the description", () => {
    const doc = parse(`Summary.

- Warning: Do not call this twice.
- Note: It is slow.
- A plain list item.
> Important: Read this.

- Returns: A value.`);
    expect(doc.description).toBe(
      "Summary.\n\n- Warning: Do not call this twice.\n- Note: It is slow.\n- A plain list item.\n> Important: Read this.",
    );
    expect(doc.returns).toBe("A value.");
  });

  test("collects several returns and throws callouts", () => {
    const doc = parse(`Summary.

- Returns: One.
- Returns: Two.
- Throws: \`\`AError\`\` first.
- Throws: \`\`B/Error\`\` second.`);
    expect(doc.returns).toBe("One.\n\nTwo.");
    expect(doc.throws).toEqual([
      { type: "AError", description: "`AError` first." },
      { type: "B.Error", description: "`B.Error` second." },
    ]);
  });

  test("turns swift code blocks into examples and keeps other code", () => {
    const doc = parse(`Sends a message.

\`\`\`swift
try await channel.send("hi")
\`\`\`

The server answers:

\`\`\`json
{ "ok": true }
\`\`\`

\`\`\`swift
// A second example, with a callout-like line:
// - Returns: nothing
channel.close()
\`\`\``);
    expect(doc.examples).toEqual([
      { lang: "swift", code: 'try await channel.send("hi")' },
      {
        lang: "swift",
        code: "// A second example, with a callout-like line:\n// - Returns: nothing\nchannel.close()",
      },
    ]);
    expect(doc.description).toBe(
      'Sends a message.\n\nThe server answers:\n\n```json\n{ "ok": true }\n```',
    );
    expect(doc.returns).toBeUndefined();
  });

  test("keeps a code block that is part of a callout with the callout", () => {
    const doc = parse(`Summary.

- Returns: A builder:
  \`\`\`swift
  let builder = make()
  \`\`\``);
    expect(doc.returns).toBe("A builder:\n```swift\nlet builder = make()\n```");
    expect(doc.examples).toEqual([]);
  });

  test("drops the Topics section, up to the next section", () => {
    const doc = parse(`A client.

## Topics

### Creating

- \`\`create(title:)\`\`

### Deleting

- \`\`delete(id:)\`\`

## See Also

The guide.`);
    expect(doc.description).toBe("A client.\n\n## See Also\n\nThe guide.");
  });

  test("turns links into names, outside code only", () => {
    const doc =
      parse(`See \`\`Note/id\`\`, \`\`AuthClient/mfa-swift.property/enroll(_:)\`\`
and <doc:GettingStarted#Setup>.

\`\`\`text
\`\`Not/aLink\`\` <doc:NotALink>
\`\`\``);
    expect(doc.description).toBe(
      "See `Note.id`, `AuthClient.mfa.enroll(_:)`\nand GettingStarted.\n\n```text\n``Not/aLink`` <doc:NotALink>\n```",
    );
  });

  test("is empty for a symbol without a comment", () => {
    expect(parseDocComment([])).toEqual({
      summary: "",
      description: "",
      parameters: new Map(),
      throws: [],
      examples: [],
    });
  });
});

describe("linkTarget", () => {
  test("joins path components with dots", () => {
    expect(linkTarget("SignUpResult/signedIn(_:)")).toBe(
      "SignUpResult.signedIn(_:)",
    );
  });

  test("drops what only tells DocC which symbol is meant", () => {
    expect(linkTarget("Client/mfa-swift.property/enroll")).toBe(
      "Client.mfa.enroll",
    );
    expect(linkTarget("select(_:)-5a3b2")).toBe("select(_:)");
    expect(linkTarget("select(_:)->Builder<T>")).toBe("select(_:)");
  });

  test("keeps an operator that starts with a hyphen", () => {
    expect(linkTarget("Money/-(_:_:)")).toBe("Money.-(_:_:)");
  });
});
