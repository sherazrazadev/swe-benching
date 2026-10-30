#!/usr/bin/env python3
"""Hidden functional suite for lima-s4.

Legitimate use that must keep working: an agent given no main user still serves
root, the unprivileged mode still serves its own user, boot-time installation is
repeatable, and the launch configuration still carries the non-UNIX transport
options and the runtime directory.
"""
import os
import sys
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "support"))

import junit  # noqa: E402
from sandbox import MAIN_UID, ROOT_UID, DirectRootSandbox, RootlessSandbox, Sandbox  # noqa: E402

TESTS = []


def test(fn):
    TESTS.append(fn)
    return fn


@test
def test_func_agent_without_owner_still_serves_root():
    with DirectRootSandbox() as sb:
        sb.start()
        assert sb.usable_by(ROOT_UID), "an agent started with no main user no longer serves root"


@test
def test_func_unprivileged_mode_still_serves_its_user():
    with RootlessSandbox(uid=MAIN_UID) as sb:
        sb.start()
        assert sb.usable_by(MAIN_UID), "the agent's unprivileged mode no longer serves its user"


@test
def test_func_two_main_user_clients_are_served():
    with RootlessSandbox(uid=MAIN_UID) as sb:
        sb.start()
        assert sb.usable_by(MAIN_UID), "the main user was not served the first time"
        assert sb.usable_by(MAIN_UID), "the agent stopped serving the main user after the first connection"


@test
def test_func_boot_install_is_repeatable():
    with Sandbox("openrc", main_uid=MAIN_UID) as sb:
        first = sb.run_boot()
        assert first.returncode == 0, "the first boot-time install failed: %s" % first.stdout[-800:]
        script = sb.openrc_script_text()
        assert "lima-guestagent" in script and "daemon" in script, \
            "the boot-time install did not produce a usable service definition"
        installed = os.path.join(sb.jail, "opt", "lima", "bin", "lima-guestagent")
        assert os.access(installed, os.X_OK), "the agent binary was not installed"
        second = sb.run_boot()
        assert second.returncode == 0, "re-running the boot-time install failed: %s" % second.stdout[-800:]
        assert sb.openrc_script_text() == script, \
            "re-running the boot-time install rewrote the service definition"


@test
def test_func_systemd_keeps_vsock_transport():
    with Sandbox("systemd", vsock="5000") as sb:
        boot = sb.run_boot()
        assert boot.returncode == 0, "the boot-time install failed: %s" % boot.stdout[-800:]
        argv, _env = sb.systemd_exec()
        joined = " ".join(argv)
        assert "--vsock-port" in argv and "5000" in joined, \
            "the generated unit no longer carries the vsock transport option"


@test
def test_func_systemd_keeps_virtio_transport():
    value = "io.lima-vm.guest_agent.1"
    with Sandbox("systemd", virtio=value) as sb:
        boot = sb.run_boot()
        assert boot.returncode == 0, "the boot-time install failed: %s" % boot.stdout[-800:]
        argv, _env = sb.systemd_exec()
        assert "--virtio-port" in argv and value in " ".join(argv), \
            "the generated unit no longer carries the virtio transport option"


@test
def test_func_systemd_keeps_runtime_directory():
    with Sandbox("systemd") as sb:
        boot = sb.run_boot()
        assert boot.returncode == 0, "the boot-time install failed: %s" % boot.stdout[-800:]
        argv, _env = sb.systemd_exec()
        assert any(a.startswith("--runtime-dir") and "/run/lima-guestagent" in a for a in argv), \
            "the generated unit no longer passes the runtime directory"


@test
def test_func_openrc_keeps_vsock_transport():
    with Sandbox("openrc", vsock="5000") as sb:
        boot = sb.run_boot()
        assert boot.returncode == 0, "the boot-time install failed: %s" % boot.stdout[-800:]
        text = sb.openrc_script_text()
        conf = open(os.path.join(sb.jail, "etc", "conf.d", "lima-guestagent")).read()
        assert "--vsock-port" in text, \
            "the openrc service definition no longer carries the vsock transport option"
        assert "LIMA_CIDATA_VSOCK_PORT=\"5000\"" in conf, \
            "the openrc service definition no longer receives the vsock transport value"


def main(out_path):
    cases = []
    for fn in TESTS:
        try:
            fn()
            cases.append((fn.__name__, "pass", ""))
        except AssertionError as e:
            cases.append((fn.__name__, "fail", str(e) + "\n" + traceback.format_exc()[-3000:]))
        except Exception as e:  # noqa: BLE001
            cases.append((fn.__name__, "error", "%s: %s\n%s" % (type(e).__name__, e,
                                                                traceback.format_exc()[-3000:])))
    junit.write_junit(out_path, "functional", cases)
    for name, status, message in cases:
        print("%s %s%s" % (status, name, "" if status == "pass" else ": " + message.splitlines()[0]))
    return 0 if all(s == "pass" for _, s, _ in cases) else 1


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: run_functional.py OUT.xml", file=sys.stderr)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
