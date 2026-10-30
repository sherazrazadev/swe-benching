package terraform

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/hashicorp/go-retryablehttp"
)

// zzProbeStubTerraform writes a terraform stand-in that prints the remote-run
// line terraform prints after a remote plan.
func zzProbeStubTerraform(t *testing.T, visitURL string) *CmdOptions {
	t.Helper()

	dir := t.TempDir()
	script := filepath.Join(dir, "terraform")
	body := "#!/bin/sh\n" +
		"echo \"To view this run in a browser, visit:\"\n" +
		"echo \"" + visitURL + "\"\n"
	if err := os.WriteFile(script, []byte(body), 0o755); err != nil { // nolint:gosec
		t.Fatalf("write terraform stub: %v", err)
	}

	return &CmdOptions{TerraformBinary: script, Dir: dir}
}

type zzProbeRequest struct {
	host string
	path string
	auth string
}

// zzProbeRoundTripper records every request and answers registry protocol
// requests with harmless canned responses.
type zzProbeRoundTripper struct {
	mu       sync.Mutex
	seen     []zzProbeRequest
	versions string
}

func (rt *zzProbeRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	rt.mu.Lock()
	rt.seen = append(rt.seen, zzProbeRequest{
		host: req.URL.Host,
		path: req.URL.Path,
		auth: req.Header.Get("Authorization"),
	})
	rt.mu.Unlock()

	body := "{}"
	header := http.Header{}
	if strings.HasSuffix(req.URL.Path, "/.well-known/terraform.json") {
		body = `{"modules.v1":"/v1/modules/"}`
		header.Set("Content-Type", "application/json")
	} else if strings.HasSuffix(req.URL.Path, "/versions") {
		body = rt.versions
		if body == "" {
			body = `{"modules":[{"versions":[{"version":"1.0.0"}]}]}`
		}
		header.Set("Content-Type", "application/json")
	}

	return &http.Response{
		StatusCode: 200,
		Status:     "200 OK",
		Header:     header,
		Body:       io.NopCloser(strings.NewReader(body)),
		Request:    req,
	}, nil
}

func (rt *zzProbeRoundTripper) Seen() []zzProbeRequest {
	rt.mu.Lock()
	defer rt.mu.Unlock()
	out := make([]zzProbeRequest, len(rt.seen))
	copy(out, rt.seen)
	return out
}

func zzProbeRetryableClient(rt http.RoundTripper) *retryablehttp.Client {
	c := retryablehttp.NewClient()
	c.HTTPClient = &http.Client{Transport: rt}
	c.RetryMax = 0
	return c
}

// zzProbeInstallDefaultTransport routes the product's plain http.Client (which
// uses http.DefaultTransport whenever its Transport is nil) through the
// recorder, so a test observes the credential the product actually attaches
// rather than only whether a connection was attempted.
func zzProbeInstallDefaultTransport(t *testing.T) *zzProbeRoundTripper {
	t.Helper()
	rt := &zzProbeRoundTripper{}
	old := http.DefaultTransport
	http.DefaultTransport = rt
	t.Cleanup(func() { http.DefaultTransport = old })
	return rt
}

// zzProbeSeenAuth reports whether any recorded request carried an
// Authorization header, returning the host it was sent to.
func zzProbeSeenAuth(seen []zzProbeRequest) (bool, string) {
	for _, r := range seen {
		if r.auth != "" {
			return true, r.host
		}
	}
	return false, ""
}
