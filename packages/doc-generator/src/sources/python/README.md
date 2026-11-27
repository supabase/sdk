# Python docstrings

This file describes how to write a docstring so that every part of it can be
converted correctly for display on
[supabase.io](https://supabase.com/docs/reference/python/introduction).

The adapter in this folder reads the docstrings from the JSON that `griffe dump`
writes. See [package README](../../../README.md#config) for config options.

Docstrings are in Google style. See [Google style](#google-style).

[Writing docstrings](#writing-docstrings) describe the docstring conventions
expected and what they convert to. Its snippets and the ids on this page come
from a fixture of the package. A test fails when this page and the generator
disagree.

## Which functions get a definition

Every function and method that a caller can import by public names alone, with a
docstring or without one.

What a module or a class makes public is griffe's reading of Python's own rules:
the names in `__all__` when a module has one, and otherwise every name that does
not start with an underscore and is not a plain import. A submodule is public
unless its name starts with an underscore.

| You write                                                                | You get                                                                                                                            |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| A public function or method, with a docstring                            | One definition.                                                                                                                    |
| The same without a docstring                                             | One definition, with an empty summary. `--verbose` lists them, and strict mode (`strict: true` or `--strict`) makes them an error. |
| A name that starts with `_`, or that `__all__` does not list             | None.                                                                                                                              |
| A class in a private module that the package's `__init__.py` lists       | Its methods are public, under the name of the package.                                                                             |
| The same method on a sync and an async client                            | Two definitions, one for each class. Write the docstring on both. `exclude` in the config can leave one class out.                 |
| An `__init__` written by hand, with a docstring or without one           | One definition: the constructor. See [Special methods](#special-methods).                                                          |
| The `__init__` that `@dataclass` writes                                  | None. The class is listed where it is passed.                                                                                      |
| Another special method, such as `__enter__`, with a docstring of its own | One definition.                                                                                                                    |
| Another special method without a docstring                               | None, and it is not listed as missing one.                                                                                         |
| A name that `exclude` in the config matches                              | None.                                                                                                                              |
| A class, an attribute                                                    | None of its own. A dataclass is listed where it is passed.                                                                         |

### Special methods

Special methods have two underscores on each side of their name, such as
`__init__` and `__enter__`. Python calls most of them for the caller, so the
caller never writes their names:

| The caller writes  | Python calls               |
| ------------------ | -------------------------- |
| `Client(...)`      | `Client.__init__`          |
| `with client:`     | `__enter__` and `__exit__` |
| `for row in rows:` | `__iter__`                 |
| `repr(client)`     | `__repr__`                 |

- **An `__init__` written by hand gets a definition, with a docstring or without
  one.** It is the constructor, and a caller calls it by the name of the class:
  `Client(supabase_url, supabase_key, http_session)`. Strict mode asks for its
  docstring. [PEP 257](https://peps.python.org/pep-0257/) puts the documentation
  of a constructor in the docstring of `__init__`.
- **The `__init__` that `@dataclass` writes gets none.** It has no line in the
  source, so there is no place to write a docstring, and strict mode could never
  pass. Its fields are already listed, each with its description, as the
  `children` of every parameter that takes the class.
- **Any other special method gets one only with a docstring of its own.** A page
  for `__enter__` or `__repr__` would document a name the caller never uses.
  Without a docstring, it is not listed as missing one either. Say what a class
  supports in the docstring of its constructor instead, such as "Use it in a
  `with` block to close the connection." A special method that has a docstring
  was written to be read, so it gets a definition.

Sphinx makes a similar choice: autodoc leaves special methods out unless
`:special-members:` asks for them.

## The id of a definition

The `id` is also the file name and the address of the page. It is made from the
code alone: the path a caller imports the function by, in lowercase words.

<!-- ids: python -->

| Defined at                            | Import path                         | `id`                                 |
| ------------------------------------- | ----------------------------------- | ------------------------------------ |
| `notes.client.SyncNotesClient.create` | `notes.SyncNotesClient.create`      | `notes-sync-notes-client-create`     |
| `notes.client.create_client`          | `notes.create_client`               | `notes-create-client`                |
| `notes.client.run_all`                | `notes.client.run_all`              | `notes-client-run-all`               |
| `notes.sharing.SharingClient.share`   | `notes.sharing.SharingClient.share` | `notes-sharing-sharing-client-share` |

- `notes/__init__.py` lists `SyncNotesClient` and `create_client` in `__all__`,
  so their import path starts at the package. It does not list `run_all` or
  `SharingClient`, so theirs goes through their module.
- When a function can be imported by several paths, one in the package that
  defines it wins. Then the shortest wins, and then the first in the alphabet.
- A word starts at a capital that follows a lowercase letter or a digit, and at
  the last capital of a run: `MFAClient` is `mfa-client`. So `OAuth` is
  `o-auth`.
- Renaming a function or its class changes the id, and with it the address of
  the page. So does changing where the package exports it. Moving it between
  private modules does not.
- When two import paths give the same id, the generator stops with an error.
- `exclude` in the config matches against the import path: `"^notes\\.Async"`
  leaves out the methods of every class of `notes` whose name starts with
  `Async`.

`category` is the package the import path starts with, such as `notes`.
`symbolPaths` in the config changes the `symbol` of a definition and nothing
else.

## Writing docstrings

A lookup: one entry for each part of a docstring, with how to write it and what
the definition gets from it. The snippets are parts of the fixture package and
of the definitions generated from it. [Complete example](#complete-example)
shows one whole docstring.

| You write                             | The definition gets                     | Entry                                                     |
| ------------------------------------- | --------------------------------------- | --------------------------------------------------------- |
| The first paragraph                   | `summary`                               | [Summary and description](#summary-and-description)       |
| The rest of the text                  | `description`                           | [Summary and description](#summary-and-description)       |
| `Note:`, `Warning:`, `See Also:`      | A quote in `description`                | [Remarks](#remarks)                                       |
| `Args:`, `Other Parameters:`          | `parameters[].description`              | [Parameters](#parameters)                                 |
| `Returns:`, `Yields:`                 | `returns.description`                   | [Return value](#return-value)                             |
| `Raises:`                             | `throws`                                | [Errors](#errors)                                         |
| An `Examples:` section                | `examples`, each with a title           | [Examples](#examples)                                     |
| `@deprecated("...")`                  | `deprecated: true`, and a note          | [Deprecation](#deprecation)                               |
| A string below a field of a dataclass | `children[].description`                | [Fields of an options class](#fields-of-an-options-class) |
| Annotations, defaults, `Literal[...]` | `type`, `required`, `default`, and more | [What comes from the code](#what-comes-from-the-code)     |

### Google style

The adapter reads Google style docstrings only, and the dump is made with
`--docstyle google`. supabase-py requires the style and checks it in CI, as its
[CONTRIBUTING.md](https://github.com/supabase/supabase-py/blob/main/CONTRIBUTING.md#docstrings)
describes. The check rejects another name for a section, such as `Params:` for
`Args:`, NumPy sections, Sphinx fields and reST directives. So each entry below
shows the one way to write a part.

### Summary and description

- The first paragraph is the `summary`, joined into one line. Lists of functions
  show it, so make it one sentence that says what the function does.
- The whole text, summary included, is the `description`, in Markdown. Wrapped
  lines stay wrapped.
- A code block or a doctest outside an `Examples:` section stays in the
  description, as code, in any language. See [Examples](#examples).
- A function without a docstring gets `summary: ""` and no `description`.

<!-- fixture excerpt: python/package/src/notes/history.py -->

````python
"""Lists the earlier versions of a note, newest first.

Each version is the note as it was saved. Its metadata is a
dictionary:

```python
{"editor": "ada@example.com"}
```
````

<!-- fixture excerpt: python/expected/notes-history-history-client-versions.md -->

````yaml
summary: "Lists the earlier versions of a note, newest first."
description: |-
  Lists the earlier versions of a note, newest first.

  Each version is the note as it was saved. Its metadata is a
  dictionary:

  ```python
  {"editor": "ada@example.com"}
  ```
````

### Remarks

- A section such as `Note:`, `Warning:`, `See Also:` or `Tip:` becomes a quote
  in the description, where it was written: `> **Note:** text`.

<!-- fixture excerpt: python/package/src/notes/history.py -->

```python
Note:
    A version is kept for 30 days.

See Also:
    `SharingClient.share`, to share a version.
```

<!-- fixture excerpt: python/expected/notes-history-history-client-versions.md -->

```yaml
  > **Note:** A version is kept for 30 days.

  > **See Also:** `SharingClient.share`, to share a version.
```

### Parameters

- `Args:` describes the parameters, one per line: `name: description`.
  `Other Parameters:` is read the same way.
- Write `*args` and `**kwargs` with or without the stars.
- Wrapped lines are joined into one line.
- The type, the default and whether a parameter is required come from the
  signature. A type written in the docstring is not read. A parameter the
  docstring leaves out still gets an entry, without a description.

<!-- fixture excerpt: python/package/src/notes/history.py -->

```python
def versions(self, note_id: str, limit: int = 10, **filters: str) -> Iterator[Note]:
    """Lists the earlier versions of a note, newest first.

    Args:
        note_id: The id of the note.

    Other Parameters:
        limit: How many versions to list at most.
        **filters: Only the versions whose metadata has these values.
```

<!-- fixture excerpt: python/expected/notes-history-history-client-versions.md -->

```yaml
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
```

### Return value

- `Returns:` or `Yields:` describes what comes back. It becomes
  `returns.description`, and the annotation becomes `returns.type`.
- A function annotated `-> None` gets no `returns`. The text of its `Returns:`
  is dropped.
- A wrapper type that `unwrapReturns` in the config names is seen through:
  `HttpMethod[list[Note]]` becomes `list[Note]`.

<!-- fixture excerpt: python/package/src/notes/history.py -->

```python
def versions(self, note_id: str, limit: int = 10, **filters: str) -> Iterator[Note]:
    """Lists the earlier versions of a note, newest first.

    Yields:
        One version at a time.
```

<!-- fixture excerpt: python/expected/notes-history-history-client-versions.md -->

```yaml
returns:
  type: "Iterator[Note]"
  description: "One version at a time."
```

### Errors

- `Raises:` lists the errors, one per line: `ErrorType: when it is raised`. Each
  becomes an entry in `throws`, with its `type`.

<!-- fixture excerpt: python/package/src/notes/client.py -->

```python
Raises:
    NotesError: If the service rejects the note.
```

<!-- fixture excerpt: python/expected/notes-sync-notes-client-create.md -->

```yaml
throws:
  - type: "NotesError"
    description: "If the service rejects the note."
```

### Examples

- Only the code in an `Examples:` section becomes an example. Code anywhere else
  in the docstring is part of the description.
- In the section, write a code block in `python`, `py` or `pycon`, or a doctest:
  lines that start with `>>>`. Each becomes one example, with its prompts and
  its output as written.
- The paragraph right above a code block or a doctest is the example's title,
  without its closing colon. Keep it to one short line: it also gives the
  example its id. An example without one is titled "Example 1", "Example 2" and
  so on.
- Other text in the section, and code in other languages, stays in the
  description.

<!-- fixture excerpt: python/package/src/notes/history.py -->

````python
Examples:
    Print the titles of the last two versions:

    >>> for version in client.versions("note-1", limit=2):
    ...     print(version.title)
    Hello
    Hello, world

    Only the versions Ada saved:

    ```python
    versions = list(client.versions("note-1", editor="ada@example.com"))
    ```
````

<!-- fixture excerpt: python/expected/notes-history-history-client-versions.md -->

```yaml
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
```

### Deprecation

- `@deprecated("message")` from `warnings` or `typing_extensions` sets
  `deprecated: true`. The message goes to the notes below the frontmatter.
- Only the decorator counts. A `Deprecated:` section is a remark, quoted in the
  description, and does not set `deprecated`.

<!-- fixture excerpt: python/package/src/notes/sharing.py -->

```python
@deprecated("Use share() instead.")
def send_link(self, note_id: str) -> str:
    """Sends a link to a note to its owner."""
```

<!-- fixture excerpt: python/expected/notes-sharing-sharing-client-send-link.md -->

```yaml
deprecated: true
> **Deprecated:** Use share() instead.
```

### Fields of an options class

- When a parameter's type is a dataclass or a pydantic model of the SDK, its
  fields are listed as the `children` of the parameter, all the way down.
  Inherited fields are included. Fields that start with `_`, and `ClassVar`s,
  are not.
- A field's description is the string right below the field. An `Attributes:`
  section in the docstring of the class is not read.
- A field is required when it has no default.

<!-- fixture excerpt: python/package/src/notes/types.py -->

```python
@dataclass
class BaseOptions:
    timeout: float = 30.0
    """Seconds to wait for the service."""

    _retries: int = 3
    version: ClassVar[int] = 1


@dataclass
class CreateOptions(BaseOptions):
    """How a note is created."""

    tags: list[str] = field(default_factory=list)
    """Tags to attach to the note."""

    folder: Folder | None = None
    """Where the note is filed. When `None`,
    the note goes to the inbox."""
```

<!-- fixture excerpt: python/expected/notes-sync-notes-client-create.md -->

```yaml
  - name: "options"
    type: "CreateOptions | None"
    children:
      - name: "timeout"
        required: false
        description: "Seconds to wait for the service."
      - name: "tags"
        description: "Tags to attach to the note."
      - name: "folder"
        description: "Where the note is filed. When `None`, the note goes to the inbox."
```

### What comes from the code

Not from the docstring, so there is nothing to write for these:

| Definition field                    | From                                                         |
| ----------------------------------- | ------------------------------------------------------------ |
| `signature`                         | The `def` line without `self`, with `async` when it is.      |
| `parameters[].type`, `returns.type` | The annotations.                                             |
| `required`, `default`               | The signature.                                               |
| `allowed_values`                    | `Literal[...]`                                               |
| `variadic`                          | `*args` and `**kwargs`                                       |
| `type_params`                       | PEP 695 type parameters: `def first[T](items: list[T]) -> T` |
| `category`                          | The package the import path starts with.                     |
| `stability`                         | Always `stable`.                                             |

### Complete example

`share` uses the parts most methods need in one docstring, and `send_link` is
deprecated:

<!-- fixture: python/package/src/notes/sharing.py -->

````python
@dataclass
class ShareOptions:
    """How a note is shared."""

    can_edit: bool = False
    """Whether the people may change the note."""

    message: str | None = None
    """A message to send along with the link. When `None`, no message is
    sent."""


class SharingClient:
    def share(
        self,
        note_id: str,
        *people: str,
        role: Literal["reader", "editor"] = "reader",
        options: ShareOptions | None = None,
    ) -> str:
        """Shares a note with other people.

        Each person gets a link to the note. The link stops working when the
        note is deleted.

        Warning:
            Anyone who has the link can read the note.

        Args:
            note_id: The id of the note to share.
            *people: The email addresses of the people to share the note
                with.
            role: What the people may do with the note.
            options: What the people are told.

        Returns:
            The link that opens the note.

        Raises:
            NotesError: If the service rejects the request.

        Examples:
            Share a note with an editor:

            ```python
            link = client.share(note.id, "ada@example.com", role="editor")
            ```
        """

    @deprecated("Use share() instead.")
    def send_link(self, note_id: str) -> str:
        """Sends a link to a note to its owner."""
````

`share` becomes this definition:

<!-- fixture: python/expected/notes-sharing-sharing-client-share.md -->

```markdown
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
```

## In this folder

| File           | What it does                                                                     |
| -------------- | -------------------------------------------------------------------------------- |
| `griffe.ts`    | Reads the dump, resolves names through scopes and imports, builds the API model. |
| `docstring.ts` | Maps the docstring sections griffe parsed to the fields of a definition.         |
| `expr.ts`      | Renders griffe's expressions back to Python source.                              |
