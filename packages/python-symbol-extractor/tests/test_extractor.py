import textwrap
from pathlib import Path

import pytest

from python_symbol_extractor import ParsedSymbol, SymbolKind, parse_python_project

FIXTURE = Path(__file__).parent / "fixtures" / "sample_project"


def names(symbols: list[ParsedSymbol]) -> set[str]:
    return {symbol.name for symbol in symbols}


def by_name(symbols: list[ParsedSymbol], name: str) -> ParsedSymbol:
    return next(symbol for symbol in symbols if symbol.name == name)


def write_project(root: Path, files: dict[str, str]) -> Path:
    for relative_path, content in files.items():
        path = root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(textwrap.dedent(content), encoding="utf-8")
    return root


@pytest.fixture(scope="module")
def symbols() -> list[ParsedSymbol]:
    return parse_python_project(FIXTURE)


class TestSampleProject:
    def test_discovers_src_and_flat_layout_packages(self, symbols):
        assert {"AuthClient", "Session", "run", "Runner", "Runner.start"} <= names(
            symbols
        )

    def test_re_exports_rescue_definitions_in_private_modules(self, symbols):
        assert {
            "AuthClient",
            "AuthClient.create",
            "AuthClient.url",
            "AuthClient.sign_in",
            "AuthClient.Options",
            "AuthClient.Options.to_dict",
        } <= names(symbols)

    def test_aliased_re_export_keeps_the_defined_name(self, symbols):
        assert "AuthError" in names(symbols)
        assert "AuthException" not in names(symbols)

    def test_imports_missing_from_all_are_not_re_exports(self, symbols):
        assert "internal_helper" not in names(symbols)
        assert "Unexported" not in names(symbols)

    def test_skips_private_names(self, symbols):
        assert "_private" not in names(symbols)
        assert "AuthClient._refresh" not in names(symbols)
        assert not any("__init__" in name for name in names(symbols))

    def test_kinds(self, symbols):
        assert by_name(symbols, "AuthClient").kind is SymbolKind.CLASS
        assert by_name(symbols, "AuthClient.create").kind is SymbolKind.METHOD
        assert by_name(symbols, "AuthClient.url").kind is SymbolKind.PROPERTY
        assert by_name(symbols, "AuthClient.sign_in").kind is SymbolKind.METHOD
        assert by_name(symbols, "AuthClient.Options").kind is SymbolKind.CLASS
        assert by_name(symbols, "run").kind is SymbolKind.FUNCTION

    def test_lines_follow_griffe(self, symbols):
        assert by_name(symbols, "AuthClient").line == 4
        assert by_name(symbols, "AuthClient.url").line == 9
        assert by_name(symbols, "AuthClient.create").line == 16
        assert by_name(symbols, "AuthClient.sign_in").line == 26
        assert by_name(symbols, "Session").line == 4

    def test_setter_and_overloads_collapse_into_one_symbol(self, symbols):
        assert [s.name for s in symbols if s.name == "AuthClient.url"] == [
            "AuthClient.url"
        ]
        assert [s.name for s in symbols if s.name == "AuthClient.sign_in"] == [
            "AuthClient.sign_in"
        ]

    def test_files_are_relative_to_the_root(self, symbols):
        assert (
            by_name(symbols, "AuthClient").file == "packages/auth/src/auth/_client.py"
        )
        assert by_name(symbols, "Session").file == "packages/auth/src/auth/models.py"
        assert by_name(symbols, "run").file == "packages/flat/flatpkg/core.py"

    def test_respects_sdk_parse_ignore(self, symbols):
        assert "GeneratedModel" not in names(symbols)
        assert "LegacyClient" not in names(symbols)

    def test_skips_tests_directories(self, symbols):
        assert "TestAuthClient" not in names(symbols)
        assert "TestRunner" not in names(symbols)

    def test_sorted_by_name(self, symbols):
        assert [s.name for s in symbols] == sorted(s.name for s in symbols)

    def test_warns_about_unparseable_files(self, capsys):
        parse_python_project(FIXTURE)
        assert (
            "warning: skipped packages/auth/src/auth/broken.py"
            in capsys.readouterr().err
        )


class TestRules:
    def test_missing_root_raises(self, tmp_path):
        with pytest.raises(NotADirectoryError):
            parse_python_project(tmp_path / "missing")

    def test_directories_without_pyproject_are_not_projects(self, tmp_path):
        write_project(tmp_path, {"pkg/__init__.py": "class Thing: ...\n"})
        assert parse_python_project(tmp_path) == []

    def test_wildcard_re_export_follows_all(self, tmp_path):
        write_project(
            tmp_path,
            {
                "pyproject.toml": "",
                "pkg/__init__.py": "from ._impl import *\n",
                "pkg/_impl.py": """
                    __all__ = ["Exposed"]

                    class Exposed: ...

                    class Hidden: ...
                """,
            },
        )
        assert names(parse_python_project(tmp_path)) == {"Exposed"}

    def test_re_export_chain_through_private_package(self, tmp_path):
        write_project(
            tmp_path,
            {
                "pyproject.toml": "",
                "pkg/__init__.py": 'from ._a import Thing\n\n__all__ = ["Thing"]\n',
                "pkg/_a/__init__.py": "from .b import Thing\n",
                "pkg/_a/b.py": "class Thing:\n    def go(self): ...\n",
            },
        )
        symbols = parse_python_project(tmp_path)
        assert names(symbols) == {"Thing", "Thing.go"}
        assert by_name(symbols, "Thing").file == "pkg/_a/b.py"

    def test_without_all_plain_imports_are_not_re_exports(self, tmp_path):
        write_project(
            tmp_path,
            {
                "pyproject.toml": "",
                "pkg/__init__.py": "from ._impl import Thing\n",
                "pkg/_impl.py": "class Thing: ...\n",
            },
        )
        assert parse_python_project(tmp_path) == []

    def test_definitions_in_public_modules_ignore_all(self, tmp_path):
        write_project(
            tmp_path,
            {
                "pyproject.toml": "",
                "pkg/__init__.py": "",
                "pkg/api.py": """
                    __all__ = ["Listed"]

                    class Listed: ...

                    class Unlisted: ...
                """,
            },
        )
        assert names(parse_python_project(tmp_path)) == {"Listed", "Unlisted"}

    def test_hidden_and_build_directories_are_skipped(self, tmp_path):
        write_project(
            tmp_path,
            {
                "pyproject.toml": "",
                "pkg/__init__.py": "class Kept: ...\n",
                ".venv/pyproject.toml": "",
                ".venv/vendored/__init__.py": "class Vendored: ...\n",
                "build/pyproject.toml": "",
                "build/copy/__init__.py": "class Built: ...\n",
            },
        )
        assert names(parse_python_project(tmp_path)) == {"Kept"}

    def test_definitions_inside_conditional_blocks(self, tmp_path):
        write_project(
            tmp_path,
            {
                "pyproject.toml": "",
                "pkg/__init__.py": """
                    from typing import TYPE_CHECKING

                    if TYPE_CHECKING:
                        class Typed: ...

                    try:
                        class Attempted: ...
                    except ImportError:
                        pass
                """,
            },
        )
        assert names(parse_python_project(tmp_path)) == {"Typed", "Attempted"}
