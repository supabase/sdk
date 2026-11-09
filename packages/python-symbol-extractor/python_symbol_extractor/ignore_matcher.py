from pathlib import Path

import pathspec


class IgnoreMatcher:
    """Matcher for `.sdk-parse-ignore`, which uses gitignore syntax."""

    def __init__(self, spec: pathspec.GitIgnoreSpec) -> None:
        self._spec = spec

    @classmethod
    def load(cls, root: Path) -> "IgnoreMatcher":
        """Loads `.sdk-parse-ignore` from `root`, or an empty matcher when absent."""
        ignore_file = root / ".sdk-parse-ignore"
        if not ignore_file.is_file():
            return cls.parse("")
        return cls.parse(ignore_file.read_text(encoding="utf-8"))

    @classmethod
    def parse(cls, content: str) -> "IgnoreMatcher":
        return cls(pathspec.GitIgnoreSpec.from_lines(content.splitlines()))

    def ignores(self, relative_path: str, is_directory: bool = False) -> bool:
        """Whether `relative_path` (POSIX-style, relative to root) is ignored.

        A directory pattern also excludes everything nested beneath the
        matched directory.
        """
        path = relative_path.replace("\\", "/")
        if is_directory and not path.endswith("/"):
            path += "/"
        return self._spec.match_file(path)
