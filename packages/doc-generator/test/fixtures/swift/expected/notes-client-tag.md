---
id: "notes-client-tag"
kind: "method"
category: "Notes"
title: "tag"
symbol: "Notes.NotesClient.tag(_:with:separator:onProgress:)"
summary: "Adds tags to a note."
description: "Adds tags to a note."
signature: "func tag(_ note: Note, with tags: String..., separator: String = \", \", onProgress: (@Sendable (Double) -> Void)? = nil)"
stability: "stable"
deprecated: false
parameters:
  - name: "note"
    location: "argument"
    type: "Note"
    required: true
    description: "The note to tag."
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
  - name: "with"
    location: "argument"
    type: "String..."
    required: true
    description: "The tags to add."
    variadic: true
  - name: "separator"
    location: "argument"
    type: "String"
    required: false
    description: "The text between two tags in the stored note."
    default: ", "
  - name: "onProgress"
    location: "argument"
    type: "(@Sendable (Double) -> Void)?"
    required: false
    description: "Called with the share of tags stored so far."
    default: "nil"
throws: []
examples:
  - id: "example-1"
    title: "Example 1"
    lang: "swift"
    code: |
      client.tag(note, with: "work", "urgent")
  - id: "example-2"
    title: "Example 2"
    lang: "swift"
    code: |
      client.tag(note, with: "home", separator: " / ") { done in
        print(done)
      }
---
