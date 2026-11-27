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
