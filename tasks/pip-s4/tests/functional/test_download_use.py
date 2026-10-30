"""Ordinary, in-bounds use must keep behaving exactly as it does today."""
from __future__ import annotations

import hashlib

from pip._internal.models.link import Link

from support import make_git_repo, run_pip, sdist_bytes


def test_normal_download_is_saved_inside(tmp_path):
    target = tmp_path / "out"
    target.mkdir()
    source = tmp_path / "x" / "demo-1.0.tar.gz"
    source.parent.mkdir()
    source.write_bytes(sdist_bytes())

    result = run_pip(["download", "--no-deps", "--no-build-isolation", "--no-cache-dir",
                      "-d", str(target), f"file://{source}"], cwd=tmp_path)

    assert result.returncode == 0, result.stderr
    assert (target / "demo-1.0.tar.gz").read_bytes() == sdist_bytes()
    assert not (tmp_path / "demo-1.0.tar.gz").exists()


def test_existing_correct_artifact_is_reused(tmp_path):
    target = tmp_path / "out"
    target.mkdir()
    target.joinpath("demo-1.0.tar.gz").write_bytes(sdist_bytes())
    digest = hashlib.sha256(sdist_bytes()).hexdigest()
    # The URL's own file does not exist: success proves the local copy was reused.
    url = f"file://{tmp_path}/x/demo-1.0.tar.gz"
    reqs = tmp_path / "reqs.txt"
    reqs.write_text(f"demo @ {url} --hash=sha256:{digest}\n", encoding="utf-8")

    result = run_pip(["download", "--no-deps", "--no-build-isolation", "--no-cache-dir",
                      "-d", str(target), "-r", str(reqs)], cwd=tmp_path)

    assert result.returncode == 0, result.stderr
    assert (target / "demo-1.0.tar.gz").read_bytes() == sdist_bytes()


def test_stale_artifact_inside_is_refreshed(tmp_path):
    target = tmp_path / "out"
    target.mkdir()
    target.joinpath("demo-1.0.tar.gz").write_bytes(b"STALE")
    source = tmp_path / "x" / "demo-1.0.tar.gz"
    source.parent.mkdir()
    source.write_bytes(sdist_bytes())
    digest = hashlib.sha256(sdist_bytes()).hexdigest()
    reqs = tmp_path / "reqs.txt"
    reqs.write_text(
        f"demo @ file://{source} --hash=sha256:{digest}\n", encoding="utf-8"
    )

    result = run_pip(["download", "--no-deps", "--no-build-isolation", "--no-cache-dir",
                      "-d", str(target), "-r", str(reqs)], cwd=tmp_path)

    assert result.returncode == 0, result.stderr
    assert (target / "demo-1.0.tar.gz").read_bytes() == sdist_bytes()


def test_normal_wheel_build_is_saved_inside(tmp_path):
    target = tmp_path / "wheels"
    target.mkdir()
    source = tmp_path / "x" / "demo-1.0.tar.gz"
    source.parent.mkdir()
    source.write_bytes(sdist_bytes())

    result = run_pip(["wheel", "--no-deps", "--no-build-isolation", "--no-cache-dir",
                      "-w", str(target), f"file://{source}"], cwd=tmp_path)

    assert result.returncode == 0, result.stderr
    assert any(target.glob("*.whl")), "the built wheel was not saved in the wheel directory"


def test_normal_vcs_archive_is_saved_inside(tmp_path):
    repo = tmp_path / "x" / "repo"
    repo.mkdir(parents=True)
    make_git_repo(repo)
    target = tmp_path / "out"
    target.mkdir()

    result = run_pip(["download", "--no-deps", "--no-build-isolation", "--no-cache-dir",
                      "-d", str(target), f"git+file://{repo}#egg=demo"], cwd=tmp_path)

    assert result.returncode == 0, result.stderr
    assert any(target.glob("*.zip")), "the checkout archive was not saved in the directory"


def test_path_less_url_still_yields_a_name():
    assert Link("https://example.com/").filename == "example.com"
    assert Link("https://user:password@example.com/").filename == "example.com"
    assert Link("https://example.com/path/").filename == "path"


def test_quotable_characters_are_decoded_once():
    assert Link("https://example.com/path/page.html").filename == "page.html"
    assert Link("https://example.com/path/page%231.html").filename == "page#1.html"
    assert (
        Link("http://yo/myproject-1.0%2Bfoobar.0-py2.py3-none-any.whl").filename
        == "myproject-1.0+foobar.0-py2.py3-none-any.whl"
    )


def test_ordinary_dotted_names_are_kept():
    assert Link("https://example.com/pkg-1.0.tar.gz").filename == "pkg-1.0.tar.gz"
    assert Link("http://yo/wheel.whl").filename == "wheel.whl"
