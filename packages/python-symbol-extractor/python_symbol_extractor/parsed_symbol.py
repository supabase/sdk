from dataclasses import dataclass
from enum import Enum


class SymbolKind(Enum):
    """The `kind` values of the `ParsedSymbol` shape shared by every extractor."""

    CLASS = "class"
    METHOD = "method"
    PROPERTY = "property"
    FUNCTION = "function"
    VARIABLE = "variable"


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
