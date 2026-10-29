package vtests

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/TecharoHQ/anubis/internal"
	"github.com/TecharoHQ/anubis/lib"
)

const (
	originMarker    = "origin-content-marker"
	denyMarker      = "Access Denied"
	checkEndpoint   = "/.within.website/x/cmd/anubis/api/check"
	checkDirectPath = "/.within.website/x/cmd/anubis/api/check"
)

type result struct {
	status int
	body   string
	served bool
}

// runCheck loads a policy, builds the real server around it and asks the server to
// authorize one request, the way a fronting proxy would.
func runCheck(t *testing.T, policyYAML string, subrequestMode bool, path string, headers map[string]string) result {
	t.Helper()

	fname := filepath.Join(t.TempDir(), "policy.yaml")
	if err := os.WriteFile(fname, []byte(policyYAML), 0o644); err != nil {
		t.Fatalf("writing the policy: %v", err)
	}
	pol, err := lib.LoadPoliciesOrDefault(t.Context(), fname, 4, "info", subrequestMode)
	if err != nil {
		t.Fatalf("loading the policy: %v", err)
	}

	var served atomic.Bool
	srv, err := lib.New(lib.Options{
		Next: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			served.Store(true)
			io.WriteString(w, originMarker)
		}),
		Policy: pol,
	})
	if err != nil {
		t.Fatalf("building the server: %v", err)
	}

	ts := httptest.NewServer(internal.RemoteXRealIP(true, "tcp", srv))
	defer ts.Close()

	req, err := http.NewRequest(http.MethodGet, ts.URL+path, nil)
	if err != nil {
		t.Fatalf("building the request: %v", err)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("sending the request: %v", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	return result{status: resp.StatusCode, body: string(body), served: served.Load()}
}

// denied asserts the policy refused the request: the origin was never asked to serve
// it and the client got the product's denial response, not a different refusal and
// not a server error.
func denied(t *testing.T, r result) {
	t.Helper()
	if r.served {
		t.Fatalf("the origin served the request; the policy rule that should have denied it did not apply")
	}
	if r.status < 400 || r.status > 499 {
		t.Fatalf("want a client-error denial response, got status %d", r.status)
	}
	if !strings.Contains(r.body, denyMarker) {
		t.Fatalf("want the access-denied response, got status %d", r.status)
	}
}

// allowed asserts the request reached the origin unharmed.
func allowed(t *testing.T, r result) {
	t.Helper()
	if !r.served {
		t.Fatalf("the origin did not serve a request no rule denies (status %d)", r.status)
	}
	if r.body != originMarker {
		t.Fatalf("the origin response was altered: %q", r.body)
	}
}

func denyPathRegex(pattern string) string {
	return "bots:\n" +
		"  - name: path-rule\n" +
		"    action: DENY\n" +
		"    path_regex: " + pattern + "\n" +
		"status_codes:\n  CHALLENGE: 200\n  DENY: 403\nstore:\n  backend: memory\n"
}

func denyPathPrefix(prefix string) string {
	return "bots:\n" +
		"  - name: prefix-rule\n" +
		"    action: DENY\n" +
		"    path_prefix: " + prefix + "\n" +
		"status_codes:\n  CHALLENGE: 200\n  DENY: 403\nstore:\n  backend: memory\n"
}

func denyExpression(expr string) string {
	return "bots:\n" +
		"  - name: expression-rule\n" +
		"    action: DENY\n" +
		"    expression: " + expr + "\n" +
		"status_codes:\n  CHALLENGE: 200\n  DENY: 403\nstore:\n  backend: memory\n"
}
