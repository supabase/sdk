from python_symbol_extractor import IgnoreMatcher


def test_load_without_file_ignores_nothing(tmp_path):
    matcher = IgnoreMatcher.load(tmp_path)
    assert not matcher.ignores("anything.py")
    assert not matcher.ignores("tests", is_directory=True)


def test_matches_directory_and_glob_patterns_honouring_negation():
    matcher = IgnoreMatcher.parse(
        """
        # comment
        **/example/**
        *_pb2.py
        build/
        !keep/build/
        """
    )
    assert matcher.ignores("packages/auth/example/main.py")
    assert matcher.ignores("packages/auth/src/models_pb2.py")
    assert matcher.ignores("build", is_directory=True)
    assert not matcher.ignores("keep/build/kept.py")
    assert not matcher.ignores("packages/auth/src/client.py")


def test_directory_patterns_exclude_their_contents():
    matcher = IgnoreMatcher.parse("build/\nexamples/\n")
    assert matcher.ignores("build/app.py")
    assert matcher.ignores("packages/a/build/gen.py")
    assert matcher.ignores("examples/p/main.py")
    assert not matcher.ignores("lib/build_helper.py")
    assert not matcher.ignores("build")


def test_patterns_with_a_slash_are_anchored_to_the_root():
    matcher = IgnoreMatcher.parse("src/*/tests/\n**/conftest.py\n")
    assert matcher.ignores("src/auth/tests", is_directory=True)
    assert matcher.ignores("src/auth/tests/test_client.py")
    assert not matcher.ignores("vendor/src/auth/tests/test_client.py")
    assert matcher.ignores("conftest.py")
    assert matcher.ignores("src/auth/tests/conftest.py")
    assert not matcher.ignores("src/auth/conftest_helpers.py")


def test_leading_slash_anchors_and_question_mark_matches_one_character():
    matcher = IgnoreMatcher.parse("/docs\nv?.py\n")
    assert matcher.ignores("docs/conf.py")
    assert not matcher.ignores("packages/docs/conf.py")
    assert matcher.ignores("src/v1.py")
    assert not matcher.ignores("src/v10.py")
