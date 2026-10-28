"""The on-premises instance configuration carries an IAM access key."""
from __future__ import annotations

from conftest import assert_owner_only, read_text, run_aws, write_file

CONFIG_NAME = "codedeploy.onpremises.yml"


def _register(home, endpoint):
    workdir = home / "work"
    workdir.mkdir()
    proc = run_aws(
        home, endpoint,
        "deploy", "register",
        "--instance-name", "marker-instance",
        "--region", "us-east-1",
        cwd=workdir,
    )
    return proc, workdir / CONFIG_NAME


def test_new_config_is_owner_only(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    proc, config = _register(home, endpoint)
    assert proc.returncode == 0, proc.stderr[-2000:]
    text = read_text(config)
    assert "SECRET-ACCESS-KEY-MARKER" in text
    assert "AKIAEXAMPLEKEY" in text
    assert_owner_only(config)


def test_existing_config_is_tightened(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    workdir = home / "work"
    workdir.mkdir()
    write_file(workdir / CONFIG_NAME, "---\nregion: old\n", 0o644)
    proc = run_aws(
        home, endpoint,
        "deploy", "register",
        "--instance-name", "marker-instance",
        "--region", "us-east-1",
        cwd=workdir,
    )
    assert proc.returncode == 0, proc.stderr[-2000:]
    text = read_text(workdir / CONFIG_NAME)
    assert "SECRET-ACCESS-KEY-MARKER" in text
    assert_owner_only(workdir / CONFIG_NAME)
