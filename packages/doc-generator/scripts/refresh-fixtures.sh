#!/usr/bin/env bash
# Rebuilds the tool output checked in under test/fixtures from the fixture
# packages next to it, then rewrites the expected definitions.
#
# Needs macOS with the Swift toolchain, uv, jq and bun. The tests themselves
# need only bun: they read the checked-in output.
#
# Review the diff afterwards. A change in test/fixtures/*/expected is a change
# in what the generator writes for every SDK.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
FIXTURES="$ROOT/test/fixtures"

# griffe parses with the interpreter it runs on, so both are pinned.
PYTHON_VERSION="3.14"
GRIFFE_VERSION="2.4.1"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Swift: emitting symbol graphs..." >&2
PACKAGE="$FIXTURES/swift/package"
mkdir -p "$WORK/graphs"
swift build \
  --package-path "$PACKAGE" \
  --scratch-path "$WORK/swift-build" \
  --target NotesKit \
  -Xswiftc -emit-symbol-graph \
  -Xswiftc -emit-symbol-graph-dir -Xswiftc "$WORK/graphs" \
  -Xswiftc -symbol-graph-minimum-access-level -Xswiftc public \
  -Xswiftc -include-spi-symbols >&2

rm -f "$FIXTURES/swift/symbol-graphs/"*.symbols.json
for graph in "$WORK"/graphs/*.symbols.json; do
  # A graph holds the absolute path of the checkout it was built in, and
  # lists relationships in a different order on every build. Both are
  # normalized so a refresh changes only what changed in the package.
  jq --arg root "file://$PACKAGE" '
    walk(if type == "string" then sub($root; "file:///fixture") else . end)
    | .relationships |= sort_by(.source, .kind, .target)
  ' "$graph" > "$FIXTURES/swift/symbol-graphs/$(basename "$graph")"
done

echo "Python: dumping with griffe $GRIFFE_VERSION..." >&2
# The dump also holds absolute paths, and source links with the commit of
# this repository. The generator reads neither.
uvx --python "$PYTHON_VERSION" --from "griffe==$GRIFFE_VERSION" \
  griffe dump --full --docstyle google --resolve-aliases \
  --search "$FIXTURES/python/package/src" notes \
  | jq '
    walk(if type == "object"
      then del(.filepath, .relative_filepath, .source_link, .git_info)
      else . end)
  ' > "$FIXTURES/python/griffe.json"

echo "Rewriting the expected definitions..." >&2
(cd "$ROOT" && UPDATE_GOLDENS=1 bun test test/golden.test.ts >&2)

echo "Done. Review the diff under $FIXTURES." >&2
