---
id: "notes-client-list"
kind: "method"
category: "Notes"
title: "list"
symbol: "Notes.NotesClient.list(page:)"
summary: "Lists notes, a page at a time."
description: "Lists notes, a page at a time."
signature: "func list(page: Page = Page()) async throws -> [Note]"
stability: "stable"
deprecated: false
parameters:
  - name: "page"
    location: "argument"
    type: "Page"
    required: false
    description: "The page of notes to return."
    default: "Page()"
    children:
      - name: "offset"
        location: "property"
        type: "Int"
        required: true
        description: "Where the page starts, and how many notes it holds."
      - name: "limit"
        location: "property"
        type: "Int"
        required: true
        description: "Where the page starts, and how many notes it holds."
returns:
  type: "[Note]"
  description: "The notes on the page."
throws: []
examples: []
---
