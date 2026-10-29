from functional_helpers import append, delete, move, read, write


def _sandbox(tmp_path):
    base = tmp_path / "workspace"
    base.mkdir()
    return base


def test_append_to_a_file_inside_works(tmp_path):
    base = _sandbox(tmp_path)
    write(base, "log.txt", "first\n")

    append(base, "log.txt", "second\n")

    assert (base / "log.txt").read_text() == "first\nsecond\n"


def test_append_into_a_new_subdirectory_inside_works(tmp_path):
    base = _sandbox(tmp_path)

    append(base, "nested/dir/new.txt", "created\n")

    assert (base / "nested" / "dir" / "new.txt").read_text() == "created\n"


def test_delete_file_inside_works(tmp_path):
    base = _sandbox(tmp_path)
    write(base, "gone.txt", "bye")

    delete(base, "gone.txt")

    assert not (base / "gone.txt").exists()


def test_delete_allowed_directory_inside_works(tmp_path):
    base = _sandbox(tmp_path)
    target = base / ".qdrant"
    target.mkdir()
    (target / "data").write_text("x")

    delete(base, ".qdrant")

    assert not target.exists()


def test_move_inside_works(tmp_path):
    base = _sandbox(tmp_path)
    (base / "sub").mkdir()
    write(base, "draft.txt", "DRAFT")

    move(base, "draft.txt", "sub/draft.txt")

    assert not (base / "draft.txt").exists()
    assert "DRAFT" in read(base, "sub/draft.txt")
