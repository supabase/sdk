---
id: "notes-client-init"
kind: "method"
category: "Notes"
title: "NotesClient.init"
symbol: "Notes.NotesClient.init(url:configuration:)"
summary: "Creates a client for the notes service."
description: "Creates a client for the notes service."
signature: "init(url: URL, configuration: Configuration = .init())"
stability: "stable"
deprecated: false
parameters:
  - name: "url"
    location: "argument"
    type: "URL"
    required: true
    description: "The URL of the notes service."
  - name: "configuration"
    location: "argument"
    type: "Configuration"
    required: false
    description: "How the client behaves."
    default: ".init()"
    children:
      - name: "timeout"
        location: "property"
        type: "TimeInterval"
        required: true
        description: "Seconds to wait for the service before a call fails."
      - name: "headers"
        location: "property"
        type: "[String : String]"
        required: true
        description: "Headers sent with every request."
throws: []
examples: []
---
