// Security tests for the MCP tools. The endpoint is mounted when the server is
// configured with it; the tools answer with container data. A caller restricted
// to team=red must not receive data about another container, whether the server
// filters the tool's answer, returns a clean tool-level error, or refuses the
// endpoint with a client error.
package vtesting

import (
	"context"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/amir20/dozzle/internal/web"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// openRestrictedMCP connects a restricted caller. It returns refused=true when
// the endpoint itself answered with a client error; a server error is a failure.
func openRestrictedMCP(t *testing.T, ts *httptest.Server, filter string) (*mcp.ClientSession, bool) {
	t.Helper()
	session, err := mcpConnect(t, ts, filter)
	if err != nil {
		status := mcpRawInitializeStatus(t, ts, filter)
		if status < 400 || status >= 500 {
			t.Fatalf("the integration failed without a client-error refusal (status %d): %v", status, err)
		}
		return nil, true
	}
	t.Cleanup(func() { _ = session.Close() })
	return session, false
}

func TestSec_MCPListHidesOutOfScopeContainers(t *testing.T) {
	host := newFakeHost()
	ts := newTestServer(t, host, web.Config{EnableMCP: true})
	session, refused := openRestrictedMCP(t, ts, permittedFilter)
	if refused {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	res, err := mcpCall(ctx, session, "list_containers", map[string]any{})
	if err != nil {
		t.Fatalf("list_containers failed instead of refusing cleanly: %v", err)
	}
	if res.IsError {
		return
	}
	text := mcpText(res)
	assertAbsent(t, text, hiddenID, "container listing")
	assertAbsent(t, text, hiddenName, "container listing")
}

func TestSec_MCPStatsHideOutOfScopeContainer(t *testing.T) {
	host := newFakeHost()
	ts := newTestServer(t, host, web.Config{EnableMCP: true})
	session, refused := openRestrictedMCP(t, ts, permittedFilter)
	if refused {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	res, err := mcpCall(ctx, session, "get_container_stats", map[string]any{
		"host":         "hostA",
		"container_id": hiddenID,
	})
	if err != nil {
		t.Fatalf("get_container_stats failed instead of refusing cleanly: %v", err)
	}
	if res.IsError {
		return
	}
	text := mcpText(res)
	assertAbsent(t, text, hiddenID, "container statistics")
	assertAbsent(t, text, hiddenName, "container statistics")
}

func TestSec_MCPLogsHideOutOfScopeContainer(t *testing.T) {
	host := newFakeHost()
	ts := newTestServer(t, host, web.Config{EnableMCP: true})
	session, refused := openRestrictedMCP(t, ts, permittedFilter)
	if refused {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	res, err := mcpCall(ctx, session, "get_container_logs", map[string]any{
		"host":           "hostA",
		"container_id":   hiddenID,
		"since_minutes":  5,
	})
	if err != nil {
		t.Fatalf("get_container_logs failed instead of refusing cleanly: %v", err)
	}
	if res.IsError {
		return
	}
	assertAbsent(t, mcpText(res), "log-line-"+hiddenID, "container logs")
}
