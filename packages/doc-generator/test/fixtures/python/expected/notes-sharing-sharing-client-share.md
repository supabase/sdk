---
id: "notes-sharing-sharing-client-share"
kind: "method"
category: "notes"
title: "share"
symbol: "notes.sharing.SharingClient.share"
summary: "Shares a note with other people."
description: |-
  Shares a note with other people.

  Each person gets a link to the note. The link stops working when the
  note is deleted.

  > **Warning:** Anyone who has the link can read the note.
signature: "def share(note_id: str, *people: str, role: Literal['reader', 'editor'] = 'reader', options: ShareOptions | None = None) -> str"
stability: "stable"
deprecated: false
parameters:
  - name: "note_id"
    location: "argument"
    type: "str"
    required: true
    description: "The id of the note to share."
  - name: "people"
    location: "argument"
    type: "str"
    required: false
    description: "The email addresses of the people to share the note with."
    variadic: true
  - name: "role"
    location: "argument"
    type: "Literal['reader', 'editor']"
    required: false
    description: "What the people may do with the note."
    default: "reader"
    allowed_values:
      - "reader"
      - "editor"
  - name: "options"
    location: "argument"
    type: "ShareOptions | None"
    required: false
    description: "What the people are told."
    default: "None"
    children:
      - name: "can_edit"
        location: "property"
        type: "bool"
        required: false
        description: "Whether the people may change the note."
      - name: "message"
        location: "property"
        type: "str | None"
        required: false
        description: "A message to send along with the link. When `None`, no message is sent."
returns:
  type: "str"
  description: "The link that opens the note."
throws:
  - type: "NotesError"
    description: "If the service rejects the request."
examples:
  - id: "share-a-note-with-an-editor"
    title: "Share a note with an editor"
    lang: "python"
    code: |
      link = client.share(note.id, "ada@example.com", role="editor")
---
