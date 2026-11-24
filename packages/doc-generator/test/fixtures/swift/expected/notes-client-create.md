---
id: "notes-client-create"
kind: "method"
category: "Notes"
title: "create"
symbol: "Notes.NotesClient.create(title:body:options:)"
summary: "Creates a note with a title and a body."
description: |-
  Creates a note with a title and a body.

  The note is stored at once. See `Note.id` for how a note is named, and
  GettingStarted for a walk-through.

  - Warning: A title longer than 100 characters is cut off.

  The service answers with the stored note:

  ```json
  { "id": "6f1c", "title": "Hello" }
  ```
signature: "func create(title: String, body: String, options: CreateOptions = .init()) async throws -> Note"
stability: "stable"
deprecated: false
parameters:
  - name: "title"
    location: "argument"
    type: "String"
    required: true
    description: "The title of the note."
  - name: "body"
    location: "argument"
    type: "String"
    required: true
    description: "The text of the note. `CreateOptions.channel` does not apply to it."
  - name: "options"
    location: "argument"
    type: "CreateOptions"
    required: false
    description: "How the note is created."
    default: ".init()"
    children:
      - name: "tags"
        location: "property"
        type: "[String]"
        required: true
        description: "Tags to attach to the note."
      - name: "channel"
        location: "property"
        type: "Channel?"
        required: false
        description: "Who is told about the note. When `nil`, nobody is."
      - name: "folder"
        location: "property"
        type: "Folder"
        required: true
        description: "Where the note is filed."
        children:
          - name: "name"
            location: "property"
            type: "String"
            required: true
            description: "The name of the folder."
          - name: "parent"
            location: "property"
            type: "Folder?"
            required: false
            description: "The folder this folder is in, if any."
returns:
  type: "Note"
  description: "The stored note, with the `Note.id` the service gave it."
throws:
  - type: "NotesError"
    description: "`NotesError` when the service rejects the note. `CancellationError` when the task is cancelled."
examples:
  - id: "example-1"
    title: "Example 1"
    lang: "swift"
    code: |
      let note = try await client.create(title: "Hello", body: "World")
---

Other signatures:

```swift
func create(contentsOf fileURL: URL, options: CreateOptions = .init()) async throws -> Note
```
