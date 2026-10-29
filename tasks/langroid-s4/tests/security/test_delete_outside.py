from security_helpers import delete


def _sandbox(tmp_path):
    base = tmp_path / "sandbox"
    base.mkdir()
    return base


def test_delete_outside_file_is_refused(tmp_path):
    base = _sandbox(tmp_path)
    victim = tmp_path / "victim.txt"
    victim.write_text("KEEP")

    delete(base, "../victim.txt")

    assert victim.exists()
    assert victim.read_text() == "KEEP"


def test_delete_outside_directory_is_refused(tmp_path):
    base = _sandbox(tmp_path)
    # The deletion helper only accepts paths under one of its allowed prefixes; a path
    # written inside such a prefix must still not reach outside the workspace.
    (base / ".qdrant").mkdir()
    outside_dir = tmp_path / "outside_dir"
    outside_dir.mkdir()
    (outside_dir / "keep.txt").write_text("KEEP")

    delete(base, ".qdrant/../../outside_dir")

    assert outside_dir.is_dir()
    assert (outside_dir / "keep.txt").read_text() == "KEEP"
