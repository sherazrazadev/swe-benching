from security_helpers import move

MARK = "OUTSIDE_MOVE_MARKER_08c5"


def _sandbox(tmp_path):
    base = tmp_path / "sandbox"
    base.mkdir()
    return base


def test_move_from_outside_is_refused(tmp_path):
    base = _sandbox(tmp_path)
    source = tmp_path / "outside_src.txt"
    source.write_text(MARK)

    move(base, "../outside_src.txt", "moved_in.txt")

    assert source.exists()
    assert source.read_text() == MARK
    assert not (base / "moved_in.txt").exists()


def test_move_to_outside_is_refused(tmp_path):
    base = _sandbox(tmp_path)
    source = base / "inside.txt"
    source.write_text("INSIDE")
    escaped = tmp_path / "escaped_dst.txt"

    move(base, "inside.txt", "../escaped_dst.txt")

    assert source.exists()
    assert not escaped.exists()
