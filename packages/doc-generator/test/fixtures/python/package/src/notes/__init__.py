"""A small package with one of everything the griffe adapter has to handle.

Its `griffe dump` is checked in as ../../griffe.json, so the tests need no
Python. Run `bun run refresh-fixtures` after changing it.
"""

from .client import AsyncNotesClient, NotesClient, SyncNotesClient, create_client
from .types import CreateOptions, Folder, Note, NotesError, SearchOptions

__all__ = [
    "AsyncNotesClient",
    "CreateOptions",
    "Folder",
    "Note",
    "NotesClient",
    "NotesError",
    "SearchOptions",
    "SyncNotesClient",
    "create_client",
]
