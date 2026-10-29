from security_helpers import write

MARK = "OUTSIDE_WRITE_MARKER_91c2"


def _sandbox(tmp_path):
    base = tmp_path / "sandbox"
    base.mkdir()
    return base


def test_write_parent_traversal_is_refused(tmp_path):
    base = _sandbox(tmp_path)
    outside = tmp_path / "outside.txt"
    outside.write_text("ORIGINAL")

    write(base, "../outside.txt", MARK)

    assert outside.read_text() == "ORIGINAL"


def test_write_absolute_path_outside_is_refused(tmp_path):
    base = _sandbox(tmp_path)
    outside = tmp_path / "abs_outside.txt"

    write(base, str(outside), MARK)

    assert not outside.exists()


def test_refused_write_creates_no_outside_parent_directories(tmp_path):
    base = _sandbox(tmp_path)
    outside_parent = tmp_path / "created_outside"

    write(base, "../created_outside/sub/file.txt", MARK)

    assert not outside_parent.exists()
