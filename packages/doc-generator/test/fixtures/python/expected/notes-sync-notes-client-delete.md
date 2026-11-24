---
id: "notes-sync-notes-client-delete"
kind: "method"
category: "notes"
title: "delete"
symbol: "client.delete"
summary: "Deletes a note."
description: "Deletes a note."
signature: "def delete(note_id: str, /) -> None"
stability: "stable"
deprecated: false
parameters:
  - name: "note_id"
    location: "argument"
    type: "str"
    required: true
    description: "The id of the note to delete."
throws:
  - type: "NotesError"
    description: "If there is no such note."
examples: []
---
