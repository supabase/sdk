---
id: "make-client"
kind: "method"
category: "NotesKit"
title: "makeClient"
symbol: "NotesKit.makeClient(url:)"
summary: "Creates a client for the notes service at `url`, with the default configuration."
description: |-
  Creates a client for the notes service at `url`, with the default
  configuration.
signature: "func makeClient(url: URL) -> NotesClient"
stability: "stable"
deprecated: false
parameters:
  - name: "url"
    location: "argument"
    type: "URL"
    required: true
    description: "The URL of the notes service."
returns:
  type: "NotesClient"
  description: "A client that is ready to use."
throws: []
examples: []
---
