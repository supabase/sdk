---
id: "notes-notes-client-move"
kind: "method"
category: "notes"
title: "move"
symbol: "notes.NotesClient.move"
summary: "Moves a note to another folder."
description: "Moves a note to another folder."
signature: "def move(note_id: str, /, folder: types.Folder, priority: float | int = 0, *, strict: Literal[True] = True, owner: None | Folder = None, context=None) -> None"
stability: "stable"
deprecated: false
parameters:
  - name: "note_id"
    location: "argument"
    type: "str"
    required: true
  - name: "folder"
    location: "argument"
    type: "types.Folder"
    required: true
    children:
      - name: "name"
        location: "property"
        type: "str"
        required: true
        description: "The name of the folder."
      - name: "parent"
        location: "property"
        type: "Folder | None"
        required: false
        description: "The folder this folder is in, if any."
  - name: "priority"
    location: "argument"
    type: "float | int"
    required: false
    default: 0
  - name: "strict"
    location: "argument"
    type: "Literal[True]"
    required: false
    default: true
    allowed_values:
      - true
  - name: "owner"
    location: "argument"
    type: "None | Folder"
    required: false
    default: "None"
    children:
      - name: "name"
        location: "property"
        type: "str"
        required: true
        description: "The name of the folder."
      - name: "parent"
        location: "property"
        type: "Folder | None"
        required: false
        description: "The folder this folder is in, if any."
  - name: "context"
    location: "argument"
    required: false
    default: "None"
throws:
  - type: "NotesError"
    description: "If there is no such note."
examples: []
---
