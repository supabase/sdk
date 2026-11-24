from collections.abc import Callable, Generator
from typing import Any

type HttpMethod[T] = Generator[Any, Any, T]
"""What a method that runs on both a sync and an async client returns."""


def handle_http_io[T](method: Callable[..., HttpMethod[T]]) -> Callable[..., T]:
    return method  # type: ignore[return-value]
