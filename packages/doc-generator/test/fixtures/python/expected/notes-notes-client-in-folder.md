---
id: "notes-notes-client-in-folder"
kind: "method"
category: "notes"
title: "in_folder"
symbol: "notes.NotesClient.in_folder"
summary: ""
signature: "def in_folder(folder: Folder) -> Self"
stability: "stable"
deprecated: false
parameters:
  - name: "folder"
    location: "argument"
    type: "Folder"
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
returns:
  type: "Self"
throws: []
examples: []
---
