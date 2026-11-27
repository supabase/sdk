from dataclasses import dataclass, field
from typing import ClassVar, Literal

from pydantic import BaseModel


class NotesError(Exception):
    """Why the notes service rejected a call."""


@dataclass
class Folder:
    """A place to file notes."""

    name: str
    """The name of the folder."""

    parent: "Folder | None" = None
    """The folder this folder is in, if any."""


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

    @property
    def is_tagged(self) -> bool:
        return bool(self.tags)


class SearchOptions(BaseModel):
    """How notes are searched."""

    query: str
    limit: int = 20
    order: Literal["asc", "desc"] = "asc"


class Note(BaseModel):
    """A stored note."""

    id: str
    title: str


class Envelope[T](BaseModel):
    """What the service wraps a result in."""

    data: T


class NoteEnvelope(Envelope[Note]):
    cursor: str | None = None
