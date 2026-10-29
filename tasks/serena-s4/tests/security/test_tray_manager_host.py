"""The tray manager's HTTP service applies the same rule as the dashboard."""
import conftest

ATTACKER_NAME = "attacker.example"


def _registered(tray, port: int) -> bool:
    return port in tray.manager._instances


def test_tray_manager_foreign_name_cannot_register(tray):
    port = conftest.free_port()
    status, _ = tray.post("/register", f"{ATTACKER_NAME}:{tray.port}", conftest.register_body(port))
    assert conftest.refused(status), status
    assert not _registered(tray, port)


def test_tray_manager_foreign_name_cannot_unregister_a_local_instance(tray):
    port = conftest.free_port()
    status, _ = tray.post("/register", f"localhost:{tray.port}", conftest.register_body(port))
    assert status == 200, status
    assert _registered(tray, port)
    status, _ = tray.post("/unregister", f"{ATTACKER_NAME}:{tray.port}", {"port": port})
    assert conftest.refused(status), status
    assert _registered(tray, port)
