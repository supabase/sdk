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
`ClassName.method`, nested classes as `Outer.Inner`.

Every failure exits with status 1, including a source file that does not parse:
a parse failure would drop the file's symbols on the pull request and its base
alike, so new public API could pass the check unnoticed. Add such a file to
`.sdk-parse-ignore` if it is not public API. A parseable file that griffe leaves
out for another reason is skipped with a warning on stderr.

## Which packages are read

Every directory under the SDK root with a `pyproject.toml` is a project. A
project's packages are the directories with an `__init__.py` directly under its
`src/` directory, or directly under the project directory when it has no `src/`.
Directories named `test` or `tests`, hidden directories, `build`, `dist`,
`node_modules`, `*.egg-info` and anything matched by `.sdk-parse-ignore` are
never entered during discovery, so neither they nor projects nested inside them
count. Finding no package at all is an error, so a layout the extractor does not
understand fails loudly instead of passing the check with an empty surface. Two
projects defining a package with the same name fail the extraction too, since
griffe can load only one of them.

Inside a package, submodules named `test`, `tests` or `conftest` are skipped.

## What counts as public

- A definition is public when neither its own name, nor any enclosing class, nor
  any module on the path to it starts with `_`. Dunder names such as `__init__`
  count as private.
- A definition in a private module is public anyway when a public module
  re-exports it: an import the importing module lists in its `__all__`, or that
  a wildcard import exposes when the module has no `__all__`. The symbol keeps
  the name, file and line it was defined with, even when the re-export renames
  it. The one exception is a definition whose own name starts with `_`: it is
  reported under the re-export's name, the only public name it has.
- A private module that a public module re-exports the same way, such as
  `from . import _impl as impl` with `impl` in `__all__`, is read as if it were
  public.
- `@property` and `@cached_property` methods are properties. Property setters
  and deleters, and `@overload` signatures, fold into the single symbol they
  belong to. Plain attributes and module-level constants are not reported.
- `line` is where griffe places the object: the first decorator of a decorated
  class or function, otherwise the `class` or `def` line.
- Paths matched by `.sdk-parse-ignore` at the SDK root (gitignore syntax) are
  skipped.

Loading is static, through [griffe](https://mkdocstrings.github.io/griffe/), so
the target packages need neither installation nor importable dependencies. The
interpreter is pinned in `.python-version`, since griffe parses with the running
interpreter's `ast` and a floating version would change what parses. Re-exports
resolve only between the packages found under the root; an import from a package
outside the tree is left alone.

## Development

```bash
uv sync --frozen
uv run --frozen ruff format --check .
uv run --frozen ruff check .
uv run --frozen pytest
```
