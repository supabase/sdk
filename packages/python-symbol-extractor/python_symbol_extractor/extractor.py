import os
import sys
from collections.abc import Iterator
from pathlib import Path

import griffe

from .ignore_matcher import IgnoreMatcher
from .parsed_symbol import ParsedSymbol, SymbolKind

_SKIPPED_DIRECTORIES = {"__pycache__", "node_modules", "build", "dist"}
_SKIPPED_PACKAGE_NAMES = {"test", "tests"}


def parse_python_project(project_root: str | Path) -> list[ParsedSymbol]:
    """Extracts the public API surface of every package under `project_root`.

    A project is any directory holding a `pyproject.toml`. Its packages are
    the directories with an `__init__.py` directly under its `src/`
    directory, or directly under the project directory when it has no
    `src/`. Paths are reported relative to `project_root`.
    """
    root = Path(project_root).resolve()
    if not root.is_dir():
        raise NotADirectoryError(f"{project_root} is not a directory")

    ignore = IgnoreMatcher.load(root)
    package_roots = find_package_roots(root, ignore)

    loader = griffe.GriffeLoader(
        search_paths=sorted(
            {str(package_root.parent) for package_root in package_roots}
        )
    )
    for package_root in package_roots:
        loader.load(package_root.name, try_relative_path=False)
    loader.resolve_aliases(external=False)
    _warn_about_skipped_files(root, package_roots, loader)

    collector = _Collector(root, ignore)
    for package_root in package_roots:
        collector.walk_module(loader.modules_collection[package_root.name])
    return sorted(collector.symbols, key=lambda s: (s.name, s.file, s.line or 0))


def find_package_roots(root: Path, ignore: IgnoreMatcher) -> list[Path]:
    """Lists the package directories of every project under `root`."""
    package_roots = []
    for dirpath, dirnames, filenames in os.walk(root):
        directory = Path(dirpath)
        dirnames[:] = sorted(
            name
            for name in dirnames
            if not _skip_directory(root, directory / name, ignore)
        )
        if "pyproject.toml" not in filenames:
            continue

        layout = directory / "src"
        if not layout.is_dir():
            layout = directory
        for child in sorted(layout.iterdir()):
            if (
                (child / "__init__.py").is_file()
                and child.name not in _SKIPPED_PACKAGE_NAMES
                and not _skip_directory(root, child, ignore)
            ):
                package_roots.append(child)
    return package_roots


def _skip_directory(root: Path, directory: Path, ignore: IgnoreMatcher) -> bool:
    name = directory.name
    if (
        name.startswith(".")
        or name in _SKIPPED_DIRECTORIES
        or name.endswith(".egg-info")
    ):
        return True
    return ignore.ignores(directory.relative_to(root).as_posix(), is_directory=True)


def _warn_about_skipped_files(
    root: Path, package_roots: list[Path], loader: griffe.GriffeLoader
) -> None:
    loaded = {
        Path(filepath)
        for module in _all_modules(loader.modules_collection.members.values())
        for filepath in _filepaths(module)
    }
    for package_root in package_roots:
        for path in sorted(package_root.rglob("*.py")):
            if "__pycache__" in path.parts or path in loaded:
                continue
            print(
                f"warning: skipped {path.relative_to(root).as_posix()}", file=sys.stderr
            )


def _all_modules(objects) -> Iterator[griffe.Module]:
    for obj in objects:
        if obj.is_alias or not obj.is_module:
            continue
        yield obj
        yield from _all_modules(obj.members.values())


def _filepaths(module: griffe.Module) -> list[Path]:
    filepath = module.filepath
    return filepath if isinstance(filepath, list) else [filepath]


class _Collector:
    """Walks griffe's module tree and collects the symbols that are public.

    A definition is public when neither its own name, nor any enclosing class,
    nor any module on the path to it starts with `_`. A definition in a private
    module also counts as public when a public module re-exports it, which is
    an import that griffe considers public: listed in the importing module's
    `__all__`, or exposed by a wildcard import when there is no `__all__`.
    Re-exported definitions are reported under the name, file and line they
    were defined with.
    """

    def __init__(self, root: Path, ignore: IgnoreMatcher) -> None:
        self._root = root
        self._ignore = ignore
        self._seen: set[str] = set()
        self.symbols: list[ParsedSymbol] = []

    def walk_module(self, module: griffe.Module) -> None:
        if module.name.startswith("_"):
            return
        for member in module.members.values():
            if member.is_alias:
                self._collect_reexport(member)
            elif member.is_module:
                self.walk_module(member)
            else:
                self._collect(member, prefix="", in_class=False)

    def _collect_reexport(self, alias: griffe.Alias) -> None:
        if not alias.is_public:
            return
        try:
            target = alias.final_target
        except (griffe.AliasResolutionError, griffe.CyclicAliasError):
            return
        if not target.is_module:
            self._collect(target, prefix="", in_class=False)

    def _collect(self, obj: griffe.Object, prefix: str, in_class: bool) -> None:
        if obj.name.startswith("_"):
            return
        kind = _kind(obj, in_class)
        if kind is None or obj.path in self._seen:
            return
        self._seen.add(obj.path)

        file = self._relative_file(obj)
        if file is None or self._ignore.ignores(file):
            return

        name = f"{prefix}.{obj.name}" if prefix else obj.name
        self.symbols.append(
            ParsedSymbol(name=name, kind=kind, file=file, line=obj.lineno)
        )
        if kind is SymbolKind.CLASS:
            for member in obj.members.values():
                if not member.is_alias:
                    self._collect(member, prefix=name, in_class=True)

    def _relative_file(self, obj: griffe.Object) -> str | None:
        filepath = obj.filepath
        if not isinstance(filepath, Path):
            return None
        try:
            return filepath.relative_to(self._root).as_posix()
        except ValueError:
            return None


def _kind(obj: griffe.Object, in_class: bool) -> SymbolKind | None:
    if obj.is_class:
        return SymbolKind.CLASS
    if obj.is_function:
        return SymbolKind.METHOD if in_class else SymbolKind.FUNCTION
    if obj.is_attribute and obj.has_labels("property"):
        return SymbolKind.PROPERTY
    return None
