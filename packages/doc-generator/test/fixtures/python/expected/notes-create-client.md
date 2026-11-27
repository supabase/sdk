---
id: "notes-create-client"
kind: "method"
category: "notes"
title: "create_client"
symbol: "notes.create_client"
summary: "Creates a client for the notes service at `url`."
description: "Creates a client for the notes service at `url`."
signature: "def create_client[Client: NotesClient](url: str, *, is_async: bool = False, timeout: float | None = None) -> NotesClient"
type_params:
  - "Client"
stability: "stable"
deprecated: false
parameters:
  - name: "url"
    location: "argument"
    type: "str"
    required: true
  - name: "is_async"
    location: "argument"
    type: "bool"
    required: false
    default: false
  - name: "timeout"
    location: "argument"
    type: "float | None"
    required: false
    default: "None"
returns:
  type: "NotesClient"
throws: []
examples: []
---
