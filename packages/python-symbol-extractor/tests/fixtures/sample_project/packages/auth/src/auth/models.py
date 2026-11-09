from dataclasses import dataclass


@dataclass
class Session:
    access_token: str


def _private() -> None:
    pass
