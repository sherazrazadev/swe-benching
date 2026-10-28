"""The on-premises instance configuration keeps exactly today's content."""
from __future__ import annotations

from conftest import read_text, run_aws


def test_register_writes_the_expected_config(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    workdir = home / "work"
    workdir.mkdir()
    proc = run_aws(
        home, endpoint,
        "deploy", "register",
        "--instance-name", "marker-instance",
        "--region", "us-east-1",
        cwd=workdir,
    )
    assert proc.returncode == 0, proc.stderr[-2000:]
    text = read_text(workdir / "codedeploy.onpremises.yml")
    assert text == (
        "---\n"
        "region: us-east-1\n"
        "iam_user_arn: arn:aws:iam::123456789012:user/marker-instance\n"
        "aws_access_key_id: AKIAEXAMPLEKEY\n"
        "aws_secret_access_key: SECRET-ACCESS-KEY-MARKER\n"
    )
    assert "Registering the on-premises instance... DONE" in proc.stdout
    assert "codedeploy.onpremises.yml" in proc.stdout


def test_register_with_provided_user_arn_writes_no_config(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    workdir = home / "work"
    workdir.mkdir()
    proc = run_aws(
        home, endpoint,
        "deploy", "register",
        "--instance-name", "marker-instance",
        "--region", "us-east-1",
        "--iam-user-arn", "arn:aws:iam::123456789012:user/provided",
        cwd=workdir,
    )
    assert proc.returncode == 0, proc.stderr[-2000:]
    assert not (workdir / "codedeploy.onpremises.yml").exists()
