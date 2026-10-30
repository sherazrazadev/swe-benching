"""Saving into a user-chosen directory must stay inside it, including on reuse."""
from __future__ import annotations

from support import run_pip, sdist_bytes


def _malicious_file_url(root, literal_rel):
    """URL whose last segment decodes twice; the file exists at the once-decoded path."""
    literal = root / "x" / literal_rel
    literal.parent.mkdir(parents=True, exist_ok=True)
    literal.write_bytes(sdist_bytes())
    encoded = literal_rel.replace("%", "%25")  # one more encoding layer in the URL
    return f"file://{root}/x/{encoded}", literal


def test_save_stays_inside_download_dir(tmp_path):
    target = tmp_path / "out" / "sub"
    target.mkdir(parents=True)
    url, _ = _malicious_file_url(tmp_path, "%2e%2e%2fdemo-1.0.tar.gz")

    run_pip(["download", "--no-deps", "--no-build-isolation", "--no-cache-dir",
             "-d", str(target), url], cwd=tmp_path)

    escaped = tmp_path / "out" / "demo-1.0.tar.gz"
    assert not escaped.exists(), "the artifact was written outside the download directory"
    assert (target / "%2e%2e%2fdemo-1.0.tar.gz").exists(), "the literal name was not kept inside"


def test_reuse_does_not_remove_a_file_outside_download_dir(tmp_path):
    target = tmp_path / "out" / "sub"
    target.mkdir(parents=True)
    canary = tmp_path / "out" / "demo-1.0.tar.gz"
    canary.write_text("CANARY-ORIGINAL", encoding="utf-8")
    url, _ = _malicious_file_url(tmp_path, "%2e%2e%2fdemo-1.0.tar.gz")
    reqs = tmp_path / "reqs.txt"
    reqs.write_text(
        f"demo @ {url} --hash=sha256:{'0' * 64}\n", encoding="utf-8"
    )

    run_pip(["download", "--no-deps", "--no-build-isolation", "--no-cache-dir",
             "-d", str(target), "-r", str(reqs)], cwd=tmp_path)

    assert canary.exists(), "a file outside the download directory was removed"
    assert canary.read_text(encoding="utf-8") == "CANARY-ORIGINAL"


def test_encoded_separator_stays_one_file_name(tmp_path):
    target = tmp_path / "out" / "sub"
    target.mkdir(parents=True)
    url, _ = _malicious_file_url(tmp_path, "a%2Fb-1.0.tar.gz")

    run_pip(["download", "--no-deps", "--no-build-isolation", "--no-cache-dir",
             "-d", str(target), url], cwd=tmp_path)

    assert (target / "a%2Fb-1.0.tar.gz").exists(), "a literal encoded separator was treated as a path"
    assert not (target / "a").exists(), "a package-supplied name created a sub-directory"
    assert not (tmp_path / "out" / "a" / "b-1.0.tar.gz").exists()
