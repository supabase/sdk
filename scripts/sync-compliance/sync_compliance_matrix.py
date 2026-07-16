#!/usr/bin/env python3
"""Insert canonical capability IDs that are missing from an SDK compliance file.

Diffs the feature IDs in the canonical `capabilities/*.yaml` files against the
keys already present in a repository's `sdk-compliance.yaml` and inserts any
missing ones as `not_implemented`. Because canonical IDs and the compliance keys
share the `area.group.feature` shape, each new ID is placed next to its existing
siblings (same `area.group.` prefix) so it lands in the correct section. An ID
whose group has no local sibling yet is appended under a comment for manual
placement. The list of added IDs is written to the new-ids output file for the
calling workflow's pull request body.
"""
import argparse
import re
import sys
from pathlib import Path

FEATURE_KEY = re.compile(r"^  ([a-z0-9_]+(?:\.[a-z0-9_]+)+):")
CANONICAL_ID = re.compile(r"^\s*-\s*id:\s*([a-z0-9_]+(?:\.[a-z0-9_]+)+)")


def read_canonical_ids(capabilities_directory):
    identifiers = set()
    for path in sorted(capabilities_directory.glob("*.yaml")):
        for line in path.read_text().splitlines():
            found = CANONICAL_ID.match(line)
            if found:
                identifiers.add(found.group(1))
    return identifiers


def feature_key_at(lines, index):
    found = FEATURE_KEY.match(lines[index])
    return found.group(1) if found else None


def read_existing_ids(lines):
    return {key for index in range(len(lines)) if (key := feature_key_at(lines, index))}


def block_end(lines, start):
    end = start + 1
    while end < len(lines) and lines[end].startswith("    "):
        end += 1
    return end


def insertion_index(lines, prefix):
    last = None
    for index in range(len(lines)):
        key = feature_key_at(lines, index)
        if key and key.startswith(prefix):
            last = index
    if last is None:
        return None
    return block_end(lines, last)


def parse_arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--compliance-file", required=True, type=Path)
    parser.add_argument("--capabilities-dir", required=True, type=Path)
    parser.add_argument("--new-ids-output", default=Path("new_ids.txt"), type=Path)
    return parser.parse_args()


def main():
    arguments = parse_arguments()
    if not arguments.capabilities_dir.is_dir():
        sys.exit(f"Canonical capabilities not found at {arguments.capabilities_dir}")
    if not arguments.compliance_file.is_file():
        sys.exit(f"Compliance file not found at {arguments.compliance_file}")

    lines = arguments.compliance_file.read_text().splitlines()
    canonical = read_canonical_ids(arguments.capabilities_dir)
    new_identifiers = sorted(canonical - read_existing_ids(lines))
    arguments.new_ids_output.write_text("\n".join(new_identifiers))
    if not new_identifiers:
        print("No new capability IDs.")
        return

    orphans = []
    for identifier in new_identifiers:
        prefix = identifier.rsplit(".", 1)[0] + "."
        index = insertion_index(lines, prefix)
        if index is None:
            orphans.append(identifier)
            continue
        lines.insert(index, f"  {identifier}: not_implemented")

    if orphans:
        lines.append("")
        lines.append(
            "  # Newly synced from the canonical spec; no local group yet, place manually."
        )
        lines += [f"  {identifier}: not_implemented" for identifier in orphans]

    arguments.compliance_file.write_text("\n".join(lines) + "\n")
    print(
        f"Added {len(new_identifiers)} new capability IDs "
        f"({len(orphans)} without an existing group)."
    )


if __name__ == "__main__":
    main()
