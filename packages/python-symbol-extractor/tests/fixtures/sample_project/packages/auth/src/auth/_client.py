from typing import overload


class AuthClient:
    def __init__(self, url: str) -> None:
        self._url = url

    @property
    def url(self) -> str:
        return self._url

    @url.setter
    def url(self, value: str) -> None:
        self._url = value

    @classmethod
    def create(cls, url: str) -> "AuthClient":
        return cls(url)

    @overload
    def sign_in(self, email: str) -> None: ...

    @overload
    def sign_in(self, email: int) -> None: ...

    def sign_in(self, email: str | int) -> None:
        pass

    def _refresh(self) -> None:
        pass

    class Options:
        def to_dict(self) -> dict[str, str]:
            return {}


class AuthError(Exception):
    pass


def internal_helper() -> None:
    pass


class Unexported:
    pass
