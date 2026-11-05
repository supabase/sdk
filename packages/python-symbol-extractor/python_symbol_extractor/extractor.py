import os
import sys
from collections.abc import Iterable, Iterator
from pathlib import Path

import griffe

from .ignore_matcher import IgnoreMatcher
from .parsed_symbol import ParsedSymbol, SymbolKind

_SKIPPED_DIRECTORIES = {"__pycache__", "node_modules", "build", "dist", "test", "tests"}


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
    loaded = []
    for package_root in package_roots:
        try:
            loader.load(package_root.name, try_relative_path=False)
        except griffe.LoadingError as error:
            relative = package_root.relative_to(root).as_posix()
            print(f"warning: skipped {relative}: {error}", file=sys.stderr)
            continue
        loaded.append(package_root)
    loader.resolve_aliases(external=False)
    _warn_about_skipped_files(root, loaded, loader)

    collector = _Collector(root, ignore)
    for package_root in loaded:
        collector.walk_module(loader.modules_collection[package_root.name])
    return sorted(collector.symbols, key=lambda s: (s.name, s.file, s.line or 0))


def find_package_roots(root: Path, ignore: IgnoreMatcher) -> list[Path]:
    """Lists the package directories of every project under `root`.

    Griffe can load only one package per name, so two projects defining a
    package with the same name fail the extraction instead of shadowing each
    other.
    """
    package_roots: dict[str, Path] = {}
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
            if not (child / "__init__.py").is_file() or _skip_directory(
                root, child, ignore
            ):
                continue
            previous = package_roots.get(child.name)
            if previous is not None:
                raise ValueError(
                    f"package {child.name} is defined in both "
                    f"{previous.relative_to(root).as_posix()} and "
                    f"{child.relative_to(root).as_posix()}"
                )
            package_roots[child.name] = child
    return list(package_roots.values())


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


def _all_modules(
    objects: Iterable[griffe.Object | griffe.Alias],
) -> Iterator[griffe.Module]:
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
    `__all__`, or exposed by a wildcard import when there is no `__all__`. The
    same applies to a private module that a public module re-exports: it is
    read as if it were public. Re-exported definitions are reported under the
    name, file and line they were defined with, except that a private name
    takes the re-export's name, since that is the only public one it has.
    """

    def __init__(self, root: Path, ignore: IgnoreMatcher) -> None:
        self._root = root
        self._ignore = ignore
        self._seen: set[str] = set()
        self.symbols: list[ParsedSymbol] = []

    def walk_module(self, module: griffe.Module) -> None:
        if module.name.startswith("_"):
            return
        self._walk_members(module)

    def _walk_members(self, module: griffe.Module) -> None:
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
        if target.is_module:
            if target.path not in self._seen:
                self._seen.add(target.path)
                self._walk_members(target)
        else:
            name = alias.name if target.name.startswith("_") else target.name
            self._collect(target, prefix="", in_class=False, name=name)

    def _collect(
        self, obj: griffe.Object, prefix: str, in_class: bool, name: str | None = None
    ) -> None:
        name = name or obj.name
        if name.startswith("_"):
            return
        kind = _kind(obj, in_class)
        if kind is None or obj.path in self._seen:
            return
        self._seen.add(obj.path)

        file = self._relative_file(obj)
        if file is None or self._ignore.ignores(file):
            return

        qualified = f"{prefix}.{name}" if prefix else name
        self.symbols.append(
            ParsedSymbol(name=qualified, kind=kind, file=file, line=obj.lineno)
        )
        if kind is SymbolKind.CLASS:
            for member in obj.members.values():
                if not member.is_alias:
                    self._collect(member, prefix=qualified, in_class=True)

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
