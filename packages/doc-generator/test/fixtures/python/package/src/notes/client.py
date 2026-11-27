from collections.abc import Callable
from typing import Literal, Self, overload

from . import types
from ._io import HttpMethod, handle_http_io
from .types import CreateOptions, Folder, Note, SearchOptions


class NotesClient:
    """What the sync and the async client share."""

    default_folder = "Inbox"

    @handle_http_io
    def search(self, options: SearchOptions, *, page: int = 1) -> HttpMethod[list[Note]]:
        """Finds the notes that match a query.

        Args:
            options: What to search for, and how many notes
                to return.
            page: The page of results to return, counted from 1.

        Examples:
            Find the notes about Python:

            >>> client.search(SearchOptions(query="python"))
        """
        yield options, page
        return []

    def in_folder(self: Self, folder: Folder) -> Self:
        return self

    def move(
        self,
        note_id: str,
        /,
        folder: "types.Folder",
        priority: float | int = 0,
        *,
        strict: Literal[True] = True,
        owner: None | Folder = None,
        context=None,
    ) -> None:
        """Moves a note to another folder.

        Raises:
            NotesError: If there is no such note.
        """

    @staticmethod
    def version() -> str:
        """The version of the notes API this client speaks."""
        return "1"


class AsyncNotesClient(NotesClient):
    async def create(
        self,
        title: str,
        body: str = "",
        options: CreateOptions | None = None,
        *tags: str,
        channel: Literal["email", "sms"] = "email",
        **metadata: str,
    ) -> Note:
        """Creates a note with a title and a body.

        The note is stored at once.

        ```python
        note = await client.create("Hello", "World")
        ```

        Args:
            title: The title of the note.
            body: The text of the note. It may be
                empty.
            options: How the note is created.
            tags: Tags to attach to the note.
            channel: Who is told about the note.
            metadata: Anything else to store with the note.

        Returns:
            The stored note.

        Raises:
            NotesError: If the service rejects the note.
        """
        return Note(id="1", title=title)

    async def delete(self, note_id: str, /) -> None:
        """Deletes a note.

        Args:
            note_id: The id of the note to delete.

        Raises:
            NotesError: If there is no such note.
        """

    async def archive(self, note_id: str) -> Note:
        return Note(id=note_id, title="")


class SyncNotesClient(NotesClient):
    def create(
        self,
        title: str,
        body: str = "",
        options: CreateOptions | None = None,
        *tags: str,
        channel: Literal["email", "sms"] = "email",
        **metadata: str,
    ) -> Note:
        """Creates a note with a title and a body.

        The note is stored at once.

        ```python
        note = client.create("Hello", "World")
        ```

        Args:
            title: The title of the note.
            body: The text of the note. It may be
                empty.
            options: How the note is created.
            tags: Tags to attach to the note.
            channel: Who is told about the note.
            metadata: Anything else to store with the note.

        Returns:
            The stored note.

        Raises:
            NotesError: If the service rejects the note.
        """
        return Note(id="1", title=title)

    def delete(self, note_id: str, /) -> None:
        """Deletes a note.

        Args:
            note_id: The id of the note to delete.

        Raises:
            NotesError: If there is no such note.
        """

    def archive(self, note_id: str) -> Note:
        return Note(id=note_id, title="")


@overload
def create_client(url: str) -> SyncNotesClient: ...
@overload
def create_client(url: str, *, is_async: Literal[True]) -> AsyncNotesClient: ...
def create_client[Client: NotesClient](
    url: str, *, is_async: bool = False, timeout: float | None = None
) -> NotesClient:
    """Creates a client for the notes service at `url`."""
    return AsyncNotesClient() if is_async else SyncNotesClient()


def run_all[*Ts, **P](callback: Callable[P, None], *values: *Ts) -> None:
    """Calls `callback` once for each value."""
