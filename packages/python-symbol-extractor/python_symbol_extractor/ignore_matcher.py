import re
from pathlib import Path


class IgnoreMatcher:
    """Gitignore-style matcher for `.sdk-parse-ignore`.

    Supports the subset of gitignore syntax the SDK repositories use: blank
    lines and `#` comments are skipped, `!` negates an earlier match, a
    trailing `/` restricts a pattern to directories, a pattern containing a
    `/` elsewhere is anchored to the ignore file's directory, and `*`, `**`
    and `?` globs are translated to regular expressions. Later rules win,
    as in git.
    """

    def __init__(self, rules: list["_Rule"]) -> None:
        self._rules = rules

    @classmethod
    def load(cls, root: Path) -> "IgnoreMatcher":
        """Loads `.sdk-parse-ignore` from `root`, or an empty matcher when absent."""
        ignore_file = root / ".sdk-parse-ignore"
        if not ignore_file.is_file():
            return cls([])
        return cls.parse(ignore_file.read_text(encoding="utf-8"))

    @classmethod
    def parse(cls, content: str) -> "IgnoreMatcher":
        rules = []
        for raw_line in content.splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue

            negated = line.startswith("!")
            if negated:
                line = line[1:]

            directory_only = line.endswith("/")
            if directory_only:
                line = line[:-1]

            rules.append(_Rule(line, negated, directory_only))
        return cls(rules)

    def ignores(self, relative_path: str, is_directory: bool = False) -> bool:
        """Whether `relative_path` (POSIX-style, relative to root) is ignored.

        A directory pattern also excludes everything nested beneath the
        matched directory.
        """
        path = relative_path.replace("\\", "/")
        ignored = False
        for rule in self._rules:
            if rule.matches(path, is_directory):
                ignored = not rule.negated
        return ignored


class _Rule:
    def __init__(self, glob: str, negated: bool, directory_only: bool) -> None:
        pattern = _compile(glob)
        self.self_or_below = re.compile(f"{pattern}(?:/.*)?$")
        self.below = re.compile(f"{pattern}/")
        self.negated = negated
        self.directory_only = directory_only

    def matches(self, path: str, is_directory: bool) -> bool:
        if self.directory_only and not is_directory:
            return self.below.match(path) is not None
        return self.self_or_below.match(path) is not None


def _compile(glob: str) -> str:
    anchored = "/" in glob
    body = glob.lstrip("/")
    parts = [r"^(?:.*/)?" if not anchored else "^"]
    i = 0
    while i < len(body):
        char = body[i]
        if body.startswith("**/", i):
            parts.append("(?:.*/)?")
            i += 3
        elif body.startswith("**", i):
            parts.append(".*")
            i += 2
        elif char == "*":
            parts.append("[^/]*")
            i += 1
        elif char == "?":
            parts.append("[^/]")
            i += 1
        else:
            parts.append(re.escape(char))
            i += 1
    return "".join(parts)
