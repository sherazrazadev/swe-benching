package modules

import (
	"io"
	"net/http"
	"strings"
	"sync"

	"github.com/hashicorp/go-retryablehttp"
)

type zzProbeRequest struct {
	host string
	path string
	auth string
}

// zzProbeRoundTripper records every request and answers registry protocol
// requests with harmless canned responses.
type zzProbeRoundTripper struct {
	mu        sync.Mutex
	seen      []zzProbeRequest
	discovery string
}

func (rt *zzProbeRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	rt.mu.Lock()
	rt.seen = append(rt.seen, zzProbeRequest{
		host: req.URL.Host,
		path: req.URL.Path,
		auth: req.Header.Get("Authorization"),
	})
	rt.mu.Unlock()

	body := ""
	header := http.Header{}
	switch {
	case strings.HasSuffix(req.URL.Path, "/.well-known/terraform.json"):
		body = rt.discovery
		if body == "" {
			body = `{"modules.v1":"/v1/modules/"}`
		}
		header.Set("Content-Type", "application/json")
	case strings.HasSuffix(req.URL.Path, "/versions"):
		body = `{"modules":[{"versions":[{"version":"1.0.0"}]}]}`
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

func zzProbeHasAuth(seen []zzProbeRequest) bool {
	for _, r := range seen {
		if r.auth != "" {
			return true
		}
	}
	return false
}
