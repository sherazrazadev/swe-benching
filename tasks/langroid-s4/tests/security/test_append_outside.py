from security_helpers import append

MARK = "OUTSIDE_APPEND_MARKER_63aa"


def _sandbox(tmp_path):
    base = tmp_path / "sandbox"
    base.mkdir()
    return base


def test_append_parent_traversal_is_refused(tmp_path):
    base = _sandbox(tmp_path)
    outside = tmp_path / "outside.txt"
    outside.write_text("ORIGINAL")

    append(base, "../outside.txt", MARK)

    assert outside.read_text() == "ORIGINAL"


def test_append_absolute_path_outside_is_refused(tmp_path):
    base = _sandbox(tmp_path)
    outside = tmp_path / "outside_new.txt"

    append(base, str(outside), MARK)

    assert not outside.exists()
