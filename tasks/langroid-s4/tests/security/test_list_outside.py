from security_helpers import listdir


def _sandbox(tmp_path):
    base = tmp_path / "sandbox"
    base.mkdir()
    return base


def test_list_parent_traversal_is_refused(tmp_path):
    base = _sandbox(tmp_path)
    (tmp_path / "outside_visible.txt").touch()

    result = listdir(base, "..")

    assert "outside_visible" not in result


def test_list_absolute_path_outside_is_refused(tmp_path):
    base = _sandbox(tmp_path)
    outside = tmp_path / "outside_dir"
    outside.mkdir()
    (outside / "outside_visible.txt").touch()

    result = listdir(base, str(outside))

    assert "outside_visible" not in result
