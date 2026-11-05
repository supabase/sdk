import json
from pathlib import Path

from python_symbol_extractor.__main__ import main

FIXTURE = Path(__file__).parent / "fixtures" / "sample_project"


def test_usage_error_without_a_root(capsys):
    assert main([]) == 1
    assert "Usage:" in capsys.readouterr().err


def test_prints_sorted_symbols_as_json(capsys):
    assert main([str(FIXTURE)]) == 0
    output = json.loads(capsys.readouterr().out)
    symbols = output["symbols"]
    assert [s["name"] for s in symbols] == sorted(s["name"] for s in symbols)
    assert symbols[0] == {
        "name": "AuthClient",
        "kind": "class",
        "file": "packages/auth/src/auth/_client.py",
        "line": 4,
    }


def test_missing_root_is_an_error(capsys, tmp_path):
    assert main([str(tmp_path / "missing")]) == 1
    assert capsys.readouterr().err.startswith("Error:")
