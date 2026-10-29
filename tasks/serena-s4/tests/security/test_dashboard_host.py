"""A request that does not name this machine's loopback interface must not be served."""
import conftest

ATTACKER_NAME = "attacker.example"


def test_foreign_name_cannot_read_dashboard_data(dashboard):
    status, payload = dashboard.get("/get_tool_names", f"{ATTACKER_NAME}:{dashboard.port}")
    assert conftest.refused(status), status
    assert b"find_symbol" not in payload


def test_foreign_name_cannot_shut_the_agent_down(dashboard):
    status, _ = dashboard.put("/shutdown", f"{ATTACKER_NAME}:{dashboard.port}")
    assert conftest.refused(status), status
    assert dashboard.agent.events == []


def test_foreign_name_with_a_forwarded_port_cannot_read(dashboard):
    status, payload = dashboard.get("/get_tool_names", f"{ATTACKER_NAME}:8080")
    assert conftest.refused(status), status
    assert b"find_symbol" not in payload


def test_foreign_name_cannot_clear_the_log(dashboard):
    status, _ = dashboard.post("/clear_logs", f"{ATTACKER_NAME}:{dashboard.port}")
    assert conftest.refused(status), status
    assert dashboard.handler.clear_count == 0


def test_foreign_name_cannot_reach_the_dashboard_page(dashboard):
    status, _ = dashboard.get("/dashboard/", f"{ATTACKER_NAME}:{dashboard.port}")
    assert conftest.refused(status), status


def test_name_that_merely_starts_with_a_local_name_is_refused(dashboard):
    status, _ = dashboard.get("/get_tool_names", f"localhost.{ATTACKER_NAME}:{dashboard.port}")
    assert conftest.refused(status), status


def test_name_that_merely_contains_a_local_name_is_refused(dashboard):
    status, _ = dashboard.get("/get_tool_names", f"evil-localhost.{ATTACKER_NAME}:{dashboard.port}")
    assert conftest.refused(status), status


def test_address_that_merely_starts_with_loopback_is_refused(dashboard):
    status, _ = dashboard.get("/get_tool_names", f"127.0.0.1.{ATTACKER_NAME}:{dashboard.port}")
    assert conftest.refused(status), status
