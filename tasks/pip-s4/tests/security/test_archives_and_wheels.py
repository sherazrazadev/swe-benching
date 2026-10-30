"""Archives and records written into a chosen directory must stay inside it."""
from __future__ import annotations

from support import make_git_repo, run_pip, sdist_bytes


def test_vcs_archive_stays_inside_download_dir(tmp_path):
    repo = tmp_path / "repo"
    make_git_repo(repo)
    (tmp_path / "x").mkdir()
    target = tmp_path / "out" / "sub"
    target.mkdir(parents=True)
    url = f"git+file://{tmp_path}/x/%252e%252e%252frepo#egg=demo"

    run_pip(["download", "--no-deps", "--no-build-isolation", "--no-cache-dir",
             "-d", str(target), url], cwd=tmp_path)

    assert not (tmp_path / "out" / "repo-1.0.zip").exists(), \
        "a checkout archive was written outside the download directory"
    assert any(target.glob("*.zip")), "the checkout archive was not saved inside"


def test_wheel_source_record_stays_inside_wheel_dir(tmp_path):
    target = tmp_path / "out" / "sub"
    target.mkdir(parents=True)
    literal = tmp_path / "x" / "%2e%2e%2fdemo-1.0.tar.gz"
    literal.parent.mkdir(parents=True)
    literal.write_bytes(sdist_bytes())
    url = f"file://{tmp_path}/x/%252e%252e%252fdemo-1.0.tar.gz"

    run_pip(["wheel", "--no-deps", "--no-build-isolation", "--no-cache-dir",
             "-w", str(target), url], cwd=tmp_path)

    assert not (tmp_path / "out" / "demo-1.0.tar.gz.url").exists(), \
        "a record file was written outside the wheel directory"
    assert any(target.glob("*.whl")), "the built wheel was not saved inside"
