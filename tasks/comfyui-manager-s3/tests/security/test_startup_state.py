"""Files left in the user folder must not be replayed or fetched when the
product starts, and must not change how it installs or what it trusts."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from support.harness import (RepoServer, install_script_line, make_install_script,
                             run_scenario, write_planted)


def test_planted_startup_script_is_not_executed(tmp_path):
    cwd, argv, marker = make_install_script(tmp_path)
    write_planted(tmp_path, {"startup-scripts/install-scripts.txt": install_script_line(cwd, argv)})

    result = run_scenario(tmp_path, "prestartup", system_api=True, params={})

    assert not os.path.exists(marker), "a planted action ran at startup"
    assert result["ok"]


def test_planted_restore_request_is_not_consumed(tmp_path):
    with RepoServer(tmp_path / "srv") as server:
        snapshot = {
            "git_custom_nodes": {server.repo_url: {"hash": None, "disabled": False}},
            "pips": {},
            "cnr_custom_nodes": {},
        }
        write_planted(tmp_path, {
            "config.ini": "[default]\nsecurity_level = normal\nnetwork_mode = offline\n",
            "startup-scripts/restore-snapshot.json": json.dumps(snapshot),
        })
        result = run_scenario(tmp_path, "prestartup", system_api=True, params={})
    assert result["ok"]
    assert not os.path.exists(os.path.join(tmp_path, "custom_nodes", "provider", "installed.marker"))


def test_old_host_ignores_planted_startup_preferences(tmp_path):
    write_planted(tmp_path, {
        "config.ini": ("[default]\nsecurity_level = weak\nnetwork_mode = offline\n"
                       "bypass_ssl = true\nfile_logging = false\ndowngrade_blacklist = plantedpkg\n"),
        "pip_overrides.json": json.dumps({"requests": "plantedpkg"}),
        "pip_blacklist.list": "plantedpkg\n",
    })
    result = run_scenario(tmp_path, "prestartup", system_api=False, params={})

    assert result["tls_unverified"] is False, "a planted preference changed TLS verification"
    assert result["pip_overrides"] == {}, "a planted file remapped packages"
    assert "plantedpkg" not in result["pip_blacklist"]
    assert "plantedpkg" not in result["pip_downgrade_blacklist"]
    assert result["file_logging"] is True


def test_planted_boot_config_does_not_weaken_tls(tmp_path):
    write_planted(tmp_path, {
        "config.ini": ("[default]\nsecurity_level = normal\nnetwork_mode = offline\n"
                       "bypass_ssl = true\nfile_logging = false\n"),
    })
    result = run_scenario(tmp_path, "prestartup", system_api=True, params={})

    assert result["tls_unverified"] is False, "a planted preference changed TLS verification"
    assert result["file_logging"] is True


def test_planted_pending_download_is_not_fetched(tmp_path):
    with RepoServer(tmp_path / "srv") as server:
        pending = {"downloads": [{"url": server.payload_url,
                                  "save_path": "checkpoints/model.bin"}]}
        write_planted(tmp_path, {
            "config.ini": "[default]\nsecurity_level = normal\nnetwork_mode = offline\n",
            "startup-scripts/pending-downloads.json": json.dumps(pending),
        })
        result = run_scenario(tmp_path, "prestartup", system_api=True, params={})
    target = os.path.join(tmp_path, "models", "checkpoints", "model.bin")
    assert result["ok"]
    assert not os.path.exists(target), "a planted download request was carried out at startup"
