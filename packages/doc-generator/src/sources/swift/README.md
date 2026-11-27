# Swift doc comments

How to write a DocC comment so that every part of it reaches the API docs.

The adapter in this folder reads the comments from the symbol graphs that the
Swift compiler emits. Its `source.format` is `swift-symbol-graph`. The
[package README](../../../README.md#config) has the config options.

The example and the ids on this page come from a fixture of the package. A test
fails when this page and the generator disagree.

## Which functions get a definition

Every public function, method and initializer in the modules the config names,
with a doc comment or without one. There is no list to keep.

| You write                                                  | You get                                                                                                                            |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A `public` function, method or initializer, with a comment | One definition.                                                                                                                    |
| The same without a doc comment                             | One definition, with an empty summary. `--verbose` lists them, and strict mode (`strict: true` or `--strict`) makes them an error. |
| `internal`, `fileprivate`, `private`                       | None. The symbol graphs hold the public API only.                                                                                  |
| `@_spi(...)`                                               | One definition, with `stability: experimental`.                                                                                    |
| A name that `exclude` in the config matches                | None.                                                                                                                              |
| A type, a property, an enum case                           | None of its own. A struct is listed where a parameter takes it.                                                                    |

## The id of a definition

The `id` is also the file name and the address of the page. It is made from the
code alone: the path through the types to the function, without the module and
without argument labels, in lowercase words.

<!-- ids: swift -->

| Function                                                 | Name                             | `id`                              |
| -------------------------------------------------------- | -------------------------------- | --------------------------------- |
| `Notes.NotesClient.share(noteWithID:with:options:)`      | `NotesClient.share`              | `notes-client-share`              |
| `Notes.NotesClient.Configuration.init(timeout:headers:)` | `NotesClient.Configuration.init` | `notes-client-configuration-init` |
| `NotesKit.makeClient(url:)`                              | `makeClient`                     | `make-client`                     |
| `Swift.Array.decode(as:decoder:)`                        | `Array.decode`                   | `array-decode`                    |
| `Foundation.JSONDecoder.notes()`                         | `JSONDecoder.notes`              | `json-decoder-notes`              |

- A word starts at a capital that follows a lowercase letter or a digit, and at
  the last capital of a run: `JSONDecoder` is `json-decoder`. So `OAuth` is
  `o-auth`.
- Renaming a function or one of its types changes the id, and with it the
  address of the page. Changing its labels or its parameters does not, and
  neither does moving it to another module.
- Overloads have one name, so they share one definition. See the last row of
  [What becomes what](#what-becomes-what).
- When two modules declare a function of the same name, the generator stops with
  an error. So does it when two names give the same id.
- `exclude` in the config matches against the name: `"\\.init$"` leaves out
  every initializer.

`category` is the module that declares the function, such as `Notes`. For an
extension of another module's type, that is the module the extension is in.

## Example

One doc comment that uses everything the generator reads:

<!-- fixture: swift/package/Sources/Notes/Sharing.swift -->

````swift
/// Shares a note with other people.
///
/// Each person gets a link to the note. The link stops working when the note is deleted
/// with ``NotesClient/delete(withID:)``. See <doc:Sharing> for who may share a note.
///
/// - Warning: Anyone who has the link can read the note.
///
/// ```swift
/// let link = try await client.share(noteWithID: note.id, with: "ada@example.com")
/// ```
///
/// The service answers with the link:
///
/// ```json
/// { "url": "https://notes.example.com/s/6f1c" }
/// ```
///
/// - Parameters:
///   - id: The ``Note/id`` of the note to share.
///   - people: The email addresses of the people to share the note with.
///   - options: What the people may do, and what they are told. A message
///     longer than 500 characters is cut off.
/// - Returns: The link that opens the note.
/// - Throws: ``NotesError`` when the service rejects the request.
///   `CancellationError` when the task is cancelled.
public func share(
  noteWithID id: UUID,
  with people: String...,
  options: ShareOptions = .init()
) async throws -> URL

/// How a note is shared.
public struct ShareOptions: Sendable {
  /// Whether the people may change the note.
  public var canEdit: Bool

  /// A message to send along with the link. When `nil`, no message is sent.
  public var message: String?
}
````

It becomes this definition:

<!-- fixture: swift/expected/notes-client-share.md -->

````markdown
---
id: "notes-client-share"
kind: "method"
category: "Notes"
title: "share"
symbol: "Notes.NotesClient.share(noteWithID:with:options:)"
summary: "Shares a note with other people."
description: |-
  Shares a note with other people.

  Each person gets a link to the note. The link stops working when the note is deleted
  with `NotesClient.delete(withID:)`. See Sharing for who may share a note.

  - Warning: Anyone who has the link can read the note.

  The service answers with the link:

  ```json
  { "url": "https://notes.example.com/s/6f1c" }
  ```
signature: "func share(noteWithID id: UUID, with people: String..., options: ShareOptions = .init()) async throws -> URL"
stability: "stable"
deprecated: false
parameters:
  - name: "noteWithID"
    location: "argument"
    type: "UUID"
    required: true
    description: "The `Note.id` of the note to share."
  - name: "with"
    location: "argument"
    type: "String..."
    required: true
    description: "The email addresses of the people to share the note with."
    variadic: true
  - name: "options"
    location: "argument"
    type: "ShareOptions"
    required: false
    description: "What the people may do, and what they are told. A message longer than 500 characters is cut off."
    default: ".init()"
    children:
      - name: "canEdit"
        location: "property"
        type: "Bool"
        required: true
        description: "Whether the people may change the note."
      - name: "message"
        location: "property"
        type: "String?"
        required: false
        description: "A message to send along with the link. When `nil`, no message is sent."
returns:
  type: "URL"
  description: "The link that opens the note."
throws:
  - type: "NotesError"
    description: "`NotesError` when the service rejects the request. `CancellationError` when the task is cancelled."
examples:
  - id: "example-1"
    title: "Example 1"
    lang: "swift"
    code: |
      let link = try await client.share(noteWithID: note.id, with: "ada@example.com")
---
````

## What becomes what

| You write                                                          | You get                                                                                                                                                              |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The first paragraph                                                | `summary`, on one line.                                                                                                                                              |
| The comment, without the callouts and examples below               | `description`. Wrapped lines stay wrapped.                                                                                                                           |
| A symbol link ` ``Type/member`` `, an article link `<doc:Article>` | The name. A definition has to stand alone, so links do not survive.                                                                                                  |
| `- Note:`, `- Warning:`, `> Important:` and other callouts         | They stay in `description`.                                                                                                                                          |
| `- Parameters:` with `- name: text`, or `- Parameter name: text`   | `parameters[].description`. Use the name the body uses (`id`), not the argument label (`noteWithID`).                                                                |
| `- Returns: text`                                                  | `returns.description`.                                                                                                                                               |
| `- Throws: text`                                                   | One entry in `throws`. Its `type` is the first symbol the text links.                                                                                                |
| A `swift` code block                                               | An example, titled "Example 1", "Example 2". Code blocks in other languages stay in `description`.                                                                   |
| A `## Topics` section                                              | Nothing. It is for the DocC sidebar.                                                                                                                                 |
| A default value in the declaration                                 | `required: false` and `default`.                                                                                                                                     |
| A parameter whose type is a struct of the package                  | `children`: one per stored property, described by the property's doc comment.                                                                                        |
| `@available(*, deprecated, message: "Use x instead.")`             | `deprecated: true`, and the message in the notes below the frontmatter.                                                                                              |
| `@_spi(...)`                                                       | `stability: experimental`.                                                                                                                                           |
| Several overloads of one function                                  | One definition. It documents the first in source order that has a doc comment, or the first when none has. The others are listed in the notes as "Other signatures". |

## In this folder

| File              | What it does                                                           |
| ----------------- | ---------------------------------------------------------------------- |
| `symbol-graph.ts` | Reads the symbol graphs and builds the API model.                      |
| `doc-comment.ts`  | Splits a doc comment into summary, description, callouts and examples. |
| `declaration.ts`  | Renders the signature and reads default values from the declaration.   |
