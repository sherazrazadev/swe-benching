"""The standalone serving entry point applies the same rule as the dashboard."""
import conftest

ATTACKER_NAME = "attacker.example"


def test_standalone_foreign_name_cannot_read_dashboard_data(standalone):
    status, payload = standalone.get("/get_tool_names", f"{ATTACKER_NAME}:{standalone.port}")
    assert conftest.refused(status), status
    assert b"find_symbol" not in payload


def test_standalone_foreign_name_cannot_shut_the_agent_down(standalone):
    status, _ = standalone.put("/shutdown", f"{ATTACKER_NAME}:8080")
    assert conftest.refused(status), status
    assert standalone.agent.events == []
