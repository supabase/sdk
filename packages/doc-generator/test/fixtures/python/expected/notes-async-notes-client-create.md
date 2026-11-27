---
id: "notes-async-notes-client-create"
kind: "method"
category: "notes"
title: "create"
symbol: "notes.AsyncNotesClient.create"
summary: "Creates a note with a title and a body."
description: |-
  Creates a note with a title and a body.

  The note is stored at once.

  ```python
  note = await client.create("Hello", "World")
  ```
signature: "async def create(title: str, body: str = '', options: CreateOptions | None = None, *tags: str, channel: Literal['email', 'sms'] = 'email', **metadata: str) -> Note"
stability: "stable"
deprecated: false
parameters:
  - name: "title"
    location: "argument"
    type: "str"
    required: true
    description: "The title of the note."
  - name: "body"
    location: "argument"
    type: "str"
    required: false
    description: "The text of the note. It may be empty."
    default: ""
  - name: "options"
    location: "argument"
    type: "CreateOptions | None"
    required: false
    description: "How the note is created."
    default: "None"
    children:
      - name: "timeout"
        location: "property"
        type: "float"
        required: false
        description: "Seconds to wait for the service."
      - name: "tags"
        location: "property"
        type: "list[str]"
        required: false
        description: "Tags to attach to the note."
      - name: "folder"
        location: "property"
        type: "Folder | None"
        required: false
        description: "Where the note is filed. When `None`, the note goes to the inbox."
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
  - name: "tags"
    location: "argument"
    type: "str"
    required: false
    description: "Tags to attach to the note."
    variadic: true
  - name: "channel"
    location: "argument"
    type: "Literal['email', 'sms']"
    required: false
    description: "Who is told about the note."
    default: "email"
    allowed_values:
      - "email"
      - "sms"
  - name: "metadata"
    location: "argument"
    type: "str"
    required: false
    description: "Anything else to store with the note."
    variadic: true
returns:
  type: "Note"
  description: "The stored note."
throws:
  - type: "NotesError"
    description: "If the service rejects the note."
examples: []
---
