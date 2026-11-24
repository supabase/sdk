# The sections of a docstring that the example of the README does not use. The
# README shows parts of this file in its lookup of what each part becomes, and
# a test compares them with this file and with the definition generated from it.

from collections.abc import Iterator

from .types import Note


class HistoryClient:
    def versions(self, note_id: str, limit: int = 10, **filters: str) -> Iterator[Note]:
        """Lists the earlier versions of a note, newest first.

        Each version is the note as it was saved. Its metadata is a
        dictionary:

        ```python
        {"editor": "ada@example.com"}
        ```

        Note:
            A version is kept for 30 days.

        See Also:
            `SharingClient.share`, to share a version.

        Args:
            note_id: The id of the note.

        Other Parameters:
            limit: How many versions to list at most.
            **filters: Only the versions whose metadata has these values.

        Yields:
            One version at a time.

        Warns:
            UserWarning: When the note has no versions.

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
        """
        yield from ()
