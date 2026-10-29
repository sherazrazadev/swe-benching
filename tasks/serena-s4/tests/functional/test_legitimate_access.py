"""Everything a local client could do before still works, on any port it uses to reach the service."""
import conftest

FORWARDED_PORT = 8080


def test_localhost_on_the_listening_port_is_served(dashboard):
    status, payload = dashboard.get("/get_tool_names", f"localhost:{dashboard.port}")
    assert status == 200, status
    assert b"find_symbol" in payload


def test_loopback_address_on_the_listening_port_is_served(dashboard):
    status, payload = dashboard.get("/get_tool_names", f"127.0.0.1:{dashboard.port}")
    assert status == 200, status
    assert b"find_symbol" in payload


def test_localhost_through_a_forwarded_port_is_served(dashboard):
    status, payload = dashboard.get("/get_tool_names", f"localhost:{FORWARDED_PORT}")
    assert status == 200, status
    assert b"find_symbol" in payload


def test_loopback_address_through_a_forwarded_port_is_served(dashboard):
    status, payload = dashboard.get("/get_tool_names", f"127.0.0.1:{FORWARDED_PORT}")
    assert status == 200, status
    assert b"find_symbol" in payload


def test_dashboard_page_is_served_to_a_local_name(dashboard):
    status, payload = dashboard.get("/dashboard/", f"localhost:{FORWARDED_PORT}")
    assert status == 200, status
    assert b"<" in payload


def test_local_write_through_a_forwarded_port_still_works(dashboard):
    status, _ = dashboard.put("/shutdown", f"localhost:{FORWARDED_PORT}")
    assert status == 200, status
    assert dashboard.agent.events == ["shutdown"]


def test_standalone_entry_point_serves_a_local_name(standalone):
    status, payload = standalone.get("/get_tool_names", f"127.0.0.1:{FORWARDED_PORT}")
    assert status == 200, status
    assert b"find_symbol" in payload


def test_tray_manager_serves_and_registers_a_local_name(tray):
    status, payload = tray.get("/health", f"localhost:{tray.port}")
    assert status == 200, status
    assert b"alive" in payload
    port = conftest.free_port()
    status, _ = tray.post("/register", f"127.0.0.1:{tray.port}", conftest.register_body(port))
    assert status == 200, status
    assert port in tray.manager._instances
