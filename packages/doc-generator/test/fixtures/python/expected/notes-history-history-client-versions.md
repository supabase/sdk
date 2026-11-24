---
id: "notes-history-history-client-versions"
kind: "method"
category: "notes"
title: "versions"
symbol: "notes.history.HistoryClient.versions"
summary: "Lists the earlier versions of a note, newest first."
description: |-
  Lists the earlier versions of a note, newest first.

  Each version is the note as it was saved. Its metadata is a
  dictionary:

  ```python
  {"editor": "ada@example.com"}
  ```

  > **Note:** A version is kept for 30 days.

  > **See Also:** `SharingClient.share`, to share a version.
signature: "def versions(note_id: str, limit: int = 10, **filters: str) -> Iterator[Note]"
stability: "stable"
deprecated: false
parameters:
  - name: "note_id"
    location: "argument"
    type: "str"
    required: true
    description: "The id of the note."
  - name: "limit"
    location: "argument"
    type: "int"
    required: false
    description: "How many versions to list at most."
    default: 10
  - name: "filters"
    location: "argument"
    type: "str"
    required: false
    description: "Only the versions whose metadata has these values."
    variadic: true
returns:
  type: "Iterator[Note]"
  description: "One version at a time."
throws: []
examples:
  - id: "print-the-titles-of-the-last-two-versions"
    title: "Print the titles of the last two versions"
    lang: "python"
    code: |
      >>> for version in client.versions("note-1", limit=2):
      ...     print(version.title)
      Hello
      Hello, world
  - id: "only-the-versions-ada-saved"
    title: "Only the versions Ada saved"
    lang: "python"
    code: |
      versions = list(client.versions("note-1", editor="ada@example.com"))
---
