# The example of the README: one docstring that uses everything the griffe
# adapter reads. A test compares the README with this file and with the
# definitions generated from it.

from dataclasses import dataclass
from typing import Literal
from warnings import deprecated


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
        return ""

    @deprecated("Use share() instead.")
    def send_link(self, note_id: str) -> str:
        """Sends a link to a note to its owner."""
        return ""
