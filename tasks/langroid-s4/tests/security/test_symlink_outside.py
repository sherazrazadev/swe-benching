from security_helpers import listdir, read, write

SECRET = "SYMLINK_READ_MARKER_2b6d"
MARK = "SYMLINK_WRITE_MARKER_4e19"


def _sandbox(tmp_path):
    base = tmp_path / "sandbox"
    base.mkdir()
    return base


def test_read_through_link_outside_is_refused(tmp_path):
    base = _sandbox(tmp_path)
    target = tmp_path / "target.txt"
    target.write_text(SECRET)
    (base / "link.txt").symlink_to(target)

    result = read(base, "link.txt")

    assert SECRET not in result


def test_write_through_link_outside_is_refused(tmp_path):
    base = _sandbox(tmp_path)
    target = tmp_path / "target.txt"
    target.write_text("ORIGINAL")
    (base / "link.txt").symlink_to(target)

    write(base, "link.txt", MARK)

    assert target.read_text() == "ORIGINAL"


def test_list_through_link_outside_is_refused(tmp_path):
    base = _sandbox(tmp_path)
    outside = tmp_path / "outside_dir"
    outside.mkdir()
    (outside / "outside_visible.txt").touch()
    (base / "dirlink").symlink_to(outside, target_is_directory=True)

    result = listdir(base, "dirlink")

    assert "outside_visible" not in result
