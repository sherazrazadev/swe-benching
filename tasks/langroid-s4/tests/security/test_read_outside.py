from security_helpers import read

SECRET = "OUTSIDE_READ_MARKER_7f3a"


def _sandbox(tmp_path):
    base = tmp_path / "sandbox"
    base.mkdir()
    return base


def test_read_parent_traversal_is_refused(tmp_path):
    base = _sandbox(tmp_path)
    (tmp_path / "secret.txt").write_text(SECRET)

    result = read(base, "../secret.txt")

    assert SECRET not in result


def test_read_absolute_path_outside_is_refused(tmp_path):
    base = _sandbox(tmp_path)
    secret = tmp_path / "secret.txt"
    secret.write_text(SECRET)

    result = read(base, str(secret))

    assert SECRET not in result


def test_read_home_style_path_is_refused(tmp_path, monkeypatch):
    base = _sandbox(tmp_path)
    home = tmp_path / "home"
    home.mkdir()
    (home / "home_secret.txt").write_text(SECRET)
    # The read helper may resolve this path against the home directory. A file of the
    # same relative name inside the workspace makes the request a genuine one.
    (base / "~").mkdir()
    (base / "~" / "home_secret.txt").write_text("decoy")
    monkeypatch.setenv("HOME", str(home))

    result = read(base, "~/home_secret.txt")

    assert SECRET not in result
