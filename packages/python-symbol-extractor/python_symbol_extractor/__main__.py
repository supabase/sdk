import json
import logging
import sys

from .extractor import parse_python_project


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print(
            "Usage: python -m python_symbol_extractor <path-to-sdk-root>",
            file=sys.stderr,
        )
        return 1

    logging.getLogger("griffe").addHandler(logging.NullHandler())
    try:
        symbols = parse_python_project(argv[0])
    except Exception as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1

    json.dump(
        {"symbols": [symbol.to_json() for symbol in symbols]}, sys.stdout, indent=2
    )
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
