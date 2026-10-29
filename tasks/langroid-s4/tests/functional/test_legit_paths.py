import git

from functional_helpers import listdir, read, write, write_with_repo


def _sandbox(tmp_path):
    base = tmp_path / "workspace"
    base.mkdir()
    return base


def test_nested_write_is_committed_and_readable(tmp_path):
    base = _sandbox(tmp_path)
    repo = git.Repo.init(base)

    result = write_with_repo(base, repo, "pkg/mod/hello.txt", "hello world")

    written = base / "pkg" / "mod" / "hello.txt"
    assert written.read_text() == "hello world"
    assert "committed" in result
    assert "hello.txt" in repo.git.ls_files()
    assert "hello world" in read(base, "pkg/mod/hello.txt")


def test_absolute_path_inside_the_directory_works(tmp_path):
    base = _sandbox(tmp_path)
    target = base / "abs.txt"

    write(base, str(target), "ABSOLUTE_INSIDE")

    assert target.read_text() == "ABSOLUTE_INSIDE"
    assert "ABSOLUTE_INSIDE" in read(base, str(target))


def test_dot_dot_that_stays_inside_works(tmp_path):
    base = _sandbox(tmp_path)
    (base / "sub").mkdir()

    write(base, "sub/../sub/ok.txt", "DOTDOT_INSIDE")

    assert (base / "sub" / "ok.txt").read_text() == "DOTDOT_INSIDE"
    assert "DOTDOT_INSIDE" in read(base, "sub/../sub/ok.txt")


def test_link_whose_target_is_inside_works(tmp_path):
    base = _sandbox(tmp_path)
    (base / "real.txt").write_text("LINK_INSIDE")
    (base / "alias.txt").symlink_to(base / "real.txt")

    assert "LINK_INSIDE" in read(base, "alias.txt")


def test_name_containing_a_tilde_character_works(tmp_path):
    base = _sandbox(tmp_path)
    (base / "notes~backup").mkdir()

    write(base, "notes~backup/log.txt", "TILDE_CHAR")

    assert (base / "notes~backup" / "log.txt").read_text() == "TILDE_CHAR"
    assert "TILDE_CHAR" in read(base, "notes~backup/log.txt")


def test_listing_the_directory_and_subdirectories_works(tmp_path):
    base = _sandbox(tmp_path)
    (base / "file1.txt").touch()
    (base / "sub").mkdir()
    (base / "sub" / "file2.txt").touch()
    (base / "empty").mkdir()

    top = listdir(base, ".")
    assert "file1.txt" in top
    assert "sub" in top

    nested = listdir(base, "sub")
    assert "file2.txt" in nested
