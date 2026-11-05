# python-symbol-extractor

Extracts the public API surface of Python packages as JSON, in the
`ParsedSymbol` shape the capability-matrix scripts consume. The Python
compliance workflow (`validate-sdk-compliance-python.yml`) runs it on the pull
request and, in `additions` mode, on the base branch to find newly added public
symbols that no `sdk-compliance.yaml` entry lists.

## Usage

```bash
cd packages/python-symbol-extractor
uv run --frozen --no-dev python -m python_symbol_extractor <path-to-sdk-root>
```

The JSON dump goes to stdout, sorted by name.

Each symbol has a `name`, a `kind`, a `file` and a `line`. `kind` is one of
`class`, `method`, `property` or `function`. Methods are reported as
`ClassName.method`, nested classes as `Outer.Inner`. Files that fail to parse
are skipped with a warning on stderr, and any other failure exits with status
1.

## Which packages are read

Every directory under the SDK root with a `pyproject.toml` is a project. A
project's packages are the directories with an `__init__.py` directly under
its `src/` directory, or directly under the project directory when it has no
`src/`. Directories named `test` or `tests`, hidden directories, `build`,
`dist`, `node_modules` and `*.egg-info` are never packages, and neither is
anything matched by `.sdk-parse-ignore`.

## What counts as public

- A definition is public when neither its own name, nor any enclosing class,
  nor any module on the path to it starts with `_`. Dunder names such as
  `__init__` count as private.
- A definition in a private module is public anyway when a public module
  re-exports it: an import the importing module lists in its `__all__`, or
  that a wildcard import exposes when the module has no `__all__`. The
  symbol keeps the name, file and line it was defined with, even when the
  re-export renames it.
- `@property` and `@cached_property` methods are properties. Property setters
  and deleters, and `@overload` signatures, fold into the single symbol they
  belong to. Plain attributes and module-level constants are not reported.
- `line` is where griffe places the object: the first decorator of a decorated
  class or function, otherwise the `class` or `def` line.
- Paths matched by `.sdk-parse-ignore` at the SDK root (gitignore syntax) are
  skipped.

Loading is static, through [griffe](https://mkdocstrings.github.io/griffe/),
so the target packages need neither installation nor importable dependencies.
Re-exports resolve only between the packages found under the root; an import
from a package outside the tree is left alone.

## Development

```bash
uv sync --frozen
uv run --frozen ruff format --check .
uv run --frozen ruff check .
uv run --frozen pytest
```
