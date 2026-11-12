from dataclasses import dataclass
from enum import Enum


class SymbolKind(Enum):
    """The `kind` values the Python extractor reports, a subset of the shared shape."""

    CLASS = "class"
    METHOD = "method"
    PROPERTY = "property"
    FUNCTION = "function"


@dataclass(frozen=True)
class ParsedSymbol:
    """A single public API symbol, in the shape the capability matrix consumes."""

    name: str
    kind: SymbolKind
    file: str
    line: int | None

    def to_json(self) -> dict[str, object]:
        symbol: dict[str, object] = {
            "name": self.name,
            "kind": self.kind.value,
            "file": self.file,
        }
        if self.line is not None:
            symbol["line"] = self.line
        return symbol
