"""The security level that gates privileged Manager operations must not be
readable from, or writable through, the folder a client can reach with the
host's user-file endpoints."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from support.harness import (RepoServer, legacy_manager_dir, run_scenario,
                             write_planted)


def _install(tmp_path, server):
    planted = {
        "config.ini": "[default]\nsecurity_level = weak\nnetwork_mode = offline\n",
    }
    write_planted(tmp_path, planted)
    return run_scenario(tmp_path, "server", system_api=True, params={
        "requests": [{"method": "POST", "path": "/customnode/install/git_url",
                      "body": server.repo_url}],
    })


def test_planted_level_cannot_open_an_install(tmp_path):
    with RepoServer(tmp_path / "srv") as server:
        result = _install(tmp_path, server)
    assert result["statuses"][0]["status"] >= 400, result["statuses"]
    assert not os.path.exists(os.path.join(tmp_path, "custom_nodes", "provider", "installed.marker"))


def test_manager_state_is_not_written_to_the_user_folder(tmp_path):
    result = run_scenario(tmp_path, "core", system_api=True, params={
        "call_get_config": True,
        "call_write_config": True,
    })
    legacy = legacy_manager_dir(tmp_path)
    writable = os.path.abspath(os.path.join(str(tmp_path), "user", "default"))
    state = os.path.abspath(result["manager_files_path"])
    assert os.path.commonpath([state, writable]) != writable, (
        "Manager state is still inside the folder the host's user-file endpoints can write")
    assert os.path.abspath(result["manager_config_path"]) != os.path.abspath(
        os.path.join(legacy, "config.ini"))
    assert not os.path.exists(os.path.join(legacy, "config.ini"))
    assert os.path.exists(result["manager_config_path"])


def test_old_host_planted_level_cannot_open_an_install(tmp_path):
    with RepoServer(tmp_path / "srv") as server:
        write_planted(tmp_path, {
            "config.ini": "[default]\nsecurity_level = weak\nnetwork_mode = offline\n",
        })
        result = run_scenario(tmp_path, "server", system_api=False, params={
            "requests": [{"method": "POST", "path": "/customnode/install/git_url",
                          "body": server.repo_url}],
        })
    assert result["statuses"][0]["status"] >= 400, result["statuses"]
    assert not os.path.exists(os.path.join(tmp_path, "custom_nodes", "provider", "installed.marker"))


def test_old_host_default_level_cannot_delete_a_saved_snapshot(tmp_path):
    setup = run_scenario(tmp_path, "core", system_api=False,
                         params={"create_snapshot": "keep"})
    result = run_scenario(tmp_path, "server", system_api=False, params={
        "requests": [{"method": "GET", "path": "/snapshot/remove?target=keep"}],
    })
    assert result["statuses"][0]["status"] >= 400, result["statuses"]
    assert os.path.exists(setup["snapshot_path"])


def test_planted_trusted_source_cannot_open_an_install(tmp_path):
    with RepoServer(tmp_path / "srv") as server:
        # The user-file endpoint is live while the product runs, so the list is planted
        # after startup, exactly as a client would write it.
        result = run_scenario(tmp_path, "server", system_api=True, params={
            "plant_after_start": {"trusted_sources.list": server.repo_url + "\n"},
            "requests": [{"method": "POST", "path": "/customnode/install/git_url",
                          "body": server.repo_url}],
        })
    assert result["statuses"][0]["status"] >= 400, result["statuses"]
    assert not os.path.exists(os.path.join(tmp_path, "custom_nodes", "provider", "installed.marker"))
