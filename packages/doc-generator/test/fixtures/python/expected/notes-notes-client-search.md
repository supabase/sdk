---
id: "notes-notes-client-search"
kind: "method"
category: "notes"
title: "search"
symbol: "notes.NotesClient.search"
summary: "Finds the notes that match a query."
description: "Finds the notes that match a query."
signature: "def search(options: SearchOptions, *, page: int = 1) -> list[Note]"
stability: "stable"
deprecated: false
parameters:
  - name: "options"
    location: "argument"
    type: "SearchOptions"
    required: true
    description: "What to search for, and how many notes to return."
    children:
      - name: "query"
        location: "property"
        type: "str"
        required: true
      - name: "limit"
        location: "property"
        type: "int"
        required: false
      - name: "order"
        location: "property"
        type: "Literal['asc', 'desc']"
        required: false
  - name: "page"
    location: "argument"
    type: "int"
    required: false
    description: "The page of results to return, counted from 1."
    default: 1
returns:
  type: "list[Note]"
throws: []
examples:
  - id: "find-the-notes-about-python"
    title: "Find the notes about Python"
    lang: "python"
    code: |
      >>> client.search(SearchOptions(query="python"))
---

Other signatures:

```python
async def search(options: SearchOptions, *, page: int = 1) -> list[Note]
```
