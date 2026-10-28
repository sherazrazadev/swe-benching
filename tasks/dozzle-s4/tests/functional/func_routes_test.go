// Functional tests for the other container-data responses: an unrestricted
// caller keeps getting complete answers, and a restricted caller keeps getting
// everything that is inside its permitted set.
package vtesting

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/amir20/dozzle/internal/web"
)

func TestFunc_UnrestrictedPreviewMatchesAllContainers(t *testing.T) {
	host := newFakeHost()
	ts := newTestServer(t, host, web.Config{})

	status, body := doJSON(t, ts, http.MethodPost, "/api/notifications/preview", `{"containerExpression":"true"}`, "")
	if status != http.StatusOK {
		t.Fatalf("the preview rejected an unrestricted caller: %d %s", status, body)
	}
	if !strings.Contains(body, visibleID) || !strings.Contains(body, hiddenID) || !strings.Contains(body, remoteID) {
		t.Fatalf("the preview did not match every container for an unrestricted caller: %s", body)
	}
}

func TestFunc_RestrictedPreviewKeepsPermittedContainers(t *testing.T) {
	host := newFakeHost()
	ts := newTestServer(t, host, web.Config{})

	status, body := doJSON(t, ts, http.MethodPost, "/api/notifications/preview", `{"containerExpression":"true"}`, permittedFilter)
	if status != http.StatusOK {
		// A refusal is a valid way to keep out-of-scope data out, but it must not
		// be a server error.
		if status >= 500 {
			t.Fatalf("the preview failed with a server error: %d %s", status, body)
		}
		return
	}
	if !strings.Contains(body, visibleID) {
		t.Fatalf("the preview dropped a permitted container: %s", body)
	}
}

func TestFunc_UnrestrictedDebugViewListsAllContainers(t *testing.T) {
	withDebugLogging(t)
	host := newFakeHost()
	ts := newTestServer(t, host, web.Config{})

	status, body := doJSON(t, ts, http.MethodGet, "/api/debug/store", "", "")
	if status != http.StatusOK {
		t.Fatalf("the debug view rejected an unrestricted caller: %d %s", status, body)
	}
	if !strings.Contains(body, visibleID) || !strings.Contains(body, hiddenID) || !strings.Contains(body, remoteID) {
		t.Fatalf("the debug view did not list every container: %s", body)
	}
}

func TestFunc_UnrestrictedMCPToolsWork(t *testing.T) {
	host := newFakeHost()
	ts := newTestServer(t, host, web.Config{EnableMCP: true})

	session, err := mcpConnect(t, ts, "")
	if err != nil {
		t.Fatalf("an unrestricted caller could not connect to the integration: %v", err)
	}
	t.Cleanup(func() { _ = session.Close() })

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	res, err := mcpCall(ctx, session, "list_containers", map[string]any{})
	if err != nil || res.IsError {
		t.Fatalf("list_containers failed for an unrestricted caller: %v", err)
	}
	text := mcpText(res)
	if !strings.Contains(text, visibleID) || !strings.Contains(text, hiddenID) || !strings.Contains(text, remoteID) {
		t.Fatalf("list_containers did not return every container: %s", text)
	}

	res, err = mcpCall(ctx, session, "get_container_stats", map[string]any{"host": "hostA", "container_id": visibleID})
	if err != nil || res.IsError {
		t.Fatalf("get_container_stats failed for a permitted container: %v", err)
	}
	if !strings.Contains(mcpText(res), visibleName) {
		t.Fatalf("get_container_stats did not return the requested container: %s", mcpText(res))
	}

	res, err = mcpCall(ctx, session, "get_container_logs", map[string]any{"host": "hostA", "container_id": visibleID, "since_minutes": 5})
	if err != nil || res.IsError {
		t.Fatalf("get_container_logs failed for a permitted container: %v", err)
	}
	if !strings.Contains(mcpText(res), "log-line-"+visibleID) {
		t.Fatalf("get_container_logs did not return the container's logs: %s", mcpText(res))
	}
}
