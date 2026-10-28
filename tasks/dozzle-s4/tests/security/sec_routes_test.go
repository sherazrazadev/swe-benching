// Security tests for the other responses that carry container data. A caller
// restricted to team=red must not receive anything about a container outside
// that set, whether the server filters the response or refuses the request with
// a client error. A server error is not a refusal.
package vtesting

import (
	"net/http"
	"testing"

	"github.com/amir20/dozzle/internal/web"
)

func TestSec_PreviewHidesOutOfScopeContainers(t *testing.T) {
	host := newFakeHost()
	ts := newTestServer(t, host, web.Config{})

	status, body := doJSON(t, ts, http.MethodPost, "/api/notifications/preview", `{"containerExpression":"true"}`, permittedFilter)
	if status >= 500 {
		t.Fatalf("the preview failed with a server error, not a refusal: %d %s", status, body)
	}
	if status >= 400 {
		return
	}
	assertAbsent(t, body, hiddenID, "rule preview")
	assertAbsent(t, body, hiddenName, "rule preview")
}

func TestSec_DebugStoreHidesOutOfScopeContainers(t *testing.T) {
	withDebugLogging(t)
	host := newFakeHost()
	ts := newTestServer(t, host, web.Config{})

	status, body := doJSON(t, ts, http.MethodGet, "/api/debug/store", "", permittedFilter)
	if status >= 500 {
		t.Fatalf("the debug view failed with a server error, not a refusal: %d %s", status, body)
	}
	if status >= 400 {
		return
	}
	assertAbsent(t, body, hiddenID, "debug view")
	assertAbsent(t, body, hiddenName, "debug view")
}
