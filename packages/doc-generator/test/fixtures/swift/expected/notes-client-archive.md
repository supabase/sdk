---
id: "notes-client-archive"
kind: "method"
category: "Notes"
title: "archive"
symbol: "Notes.NotesClient.archive(_:)"
summary: "Moves a note out of sight without deleting it."
description: "Moves a note out of sight without deleting it."
signature: "@discardableResult func archive(_ note: Note) async throws -> Note"
stability: "experimental"
deprecated: false
parameters:
  - name: "note"
    location: "argument"
    type: "Note"
    required: true
    description: "The note to archive."
    children:
      - name: "id"
        location: "property"
        type: "UUID"
        required: true
        description: "The identifier the service gave the note."
      - name: "title"
        location: "property"
        type: "String"
        required: true
        description: "The title of the note."
returns:
  type: "Note"
  description: "The archived note."
throws: []
examples: []
---
