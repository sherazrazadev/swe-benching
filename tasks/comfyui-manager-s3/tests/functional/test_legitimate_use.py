"""Everything an operator or a client is allowed to do today must keep working."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from support.harness import (RepoServer, install_marker, install_script_line,
                             make_install_script, run_scenario)


def test_saved_security_level_survives_a_restart(tmp_path):
    first = run_scenario(tmp_path, "core", system_api=True, params={
        "write_config_in_manager": "[default]\nsecurity_level = weak\nnetwork_mode = offline\n",
    })
    second = run_scenario(tmp_path, "core", system_api=True, params={})
    assert second["config"]["security_level"] == "weak"
    assert os.path.abspath(first["manager_config_path"]) == os.path.abspath(
        second["manager_config_path"])


def test_allowed_install_still_installs(tmp_path):
    with RepoServer(tmp_path / "srv") as server:
        result = run_scenario(tmp_path, "server", system_api=True, params={
            "write_config_in_manager": "[default]\nsecurity_level = weak\nnetwork_mode = offline\n",
            "requests": [{"method": "POST", "path": "/customnode/install/git_url",
                          "body": server.repo_url}],
        })
    assert result["statuses"][0]["status"] < 400, result["statuses"]
    assert os.path.exists(install_marker(tmp_path))


def test_queued_management_script_runs_on_the_next_start(tmp_path):
    cwd, argv, marker = make_install_script(tmp_path)
    run_scenario(tmp_path, "core", system_api=True, params={
        "write_config_in_manager": "[default]\nsecurity_level = normal\nnetwork_mode = offline\n",
        "reserve_script": {"cwd": cwd, "cmd": argv},
    })
    result = run_scenario(tmp_path, "prestartup", system_api=True, params={})
    assert result["ok"]
    assert os.path.exists(marker), "a queued management script was not replayed"


def test_host_update_stays_reachable_on_an_old_host(tmp_path):
    result = run_scenario(tmp_path, "server", system_api=False, params={
        "requests": [{"method": "GET", "path": "/manager/queue/update_comfyui"}],
    })
    assert result["statuses"][0]["status"] < 400, result["statuses"]


def test_saved_security_level_is_not_overwritten_by_a_settings_save(tmp_path):
    result = run_scenario(tmp_path, "core", system_api=False, params={
        "write_config_in_manager": "[default]\nsecurity_level = weak\nnetwork_mode = offline\n",
        "call_get_config": True,
        "call_write_config": True,
    })
    saved = {}
    for line in (result["config_file"] or "").splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            saved[key.strip()] = value.strip()
    assert saved.get("security_level") == "weak", "the operator's saved level was replaced"


def test_scheduled_restore_still_runs(tmp_path):
    with RepoServer(tmp_path / "srv") as server:
        snapshot = {
            "git_custom_nodes": {server.repo_url: {"hash": None, "disabled": False}},
            "pips": {},
            "cnr_custom_nodes": {},
        }
        run_scenario(tmp_path, "core", system_api=True, params={
            "write_config_in_manager": "[default]\nsecurity_level = normal\nnetwork_mode = offline\n",
            "create_snapshot": "saved",
            "snapshot_content": json.dumps(snapshot),
        })
        scheduled = run_scenario(tmp_path, "server", system_api=True, params={
            "requests": [{"method": "GET", "path": "/snapshot/restore?target=saved"}],
        })
        assert scheduled["statuses"][0]["status"] < 400, scheduled["statuses"]
        result = run_scenario(tmp_path, "prestartup", system_api=True, params={})
    assert result["ok"]
    assert os.path.exists(install_marker(tmp_path)), "a scheduled restore did not run"


def test_saved_startup_preferences_still_apply(tmp_path):
    run_scenario(tmp_path, "core", system_api=True, params={
        "write_config_in_manager": ("[default]\nsecurity_level = normal\nnetwork_mode = offline\n"
                                    "bypass_ssl = true\nfile_logging = false\n"),
    })
    result = run_scenario(tmp_path, "prestartup", system_api=True, params={})
    assert result["tls_unverified"] is True
    assert result["file_logging"] is False


def test_trusted_source_still_installs(tmp_path):
    with RepoServer(tmp_path / "srv") as server:
        result = run_scenario(tmp_path, "server", system_api=True, params={
            "write_config_in_manager": "[default]\nsecurity_level = normal\nnetwork_mode = offline\n",
            "write_trust": server.repo_url + "\n",
            "requests": [{"method": "POST", "path": "/customnode/install/git_url",
                          "body": server.repo_url}],
        })
    assert result["statuses"][0]["status"] < 400, result["statuses"]
    assert os.path.exists(install_marker(tmp_path))


def test_queued_download_runs_on_the_next_start(tmp_path):
    with RepoServer(tmp_path / "srv") as server:
        queued = run_scenario(tmp_path, "server", system_api=True, params={
            "write_config_in_manager": "[default]\nsecurity_level = normal\nnetwork_mode = offline\n",
            "requests": [{"method": "POST", "path": "/manager/queue/model_download",
                          "body": json.dumps({"url": server.payload_url,
                                              "save_path": "checkpoints/model.bin"})}],
        })
        assert queued["statuses"][0]["status"] < 400, queued["statuses"]
        result = run_scenario(tmp_path, "prestartup", system_api=True, params={})
    target = os.path.join(tmp_path, "models", "checkpoints", "model.bin")
    assert result["ok"]
    assert os.path.exists(target), "a queued download did not resume at startup"
    with open(target, encoding="utf-8") as f:
        assert f.read() == "PAYLOAD-MARKER"


def test_snapshot_removal_still_works(tmp_path):
    run_scenario(tmp_path, "core", system_api=True, params={
        "write_config_in_manager": "[default]\nsecurity_level = normal\nnetwork_mode = offline\n",
        "create_snapshot": "gone",
    })
    result = run_scenario(tmp_path, "server", system_api=True, params={
        "requests": [{"method": "GET", "path": "/snapshot/remove?target=gone"}],
    })
    assert result["statuses"][0]["status"] < 400, result["statuses"]
    snap_dir = os.path.join(result["manager_files_path"], "snapshots")
    assert not os.path.exists(os.path.join(snap_dir, "gone.json"))
