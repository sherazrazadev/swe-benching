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
	case strings.HasSuffix(req.URL.Path, "/download"):
		header.Set("X-Terraform-Get", "https://registry.example.invalid/archive.tgz")
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

// zzProbeAuthHosts returns the hosts that received an Authorization header.
func zzProbeAuthHosts(seen []zzProbeRequest) []string {
	var hosts []string
	for _, r := range seen {
		if r.auth != "" {
			hosts = append(hosts, r.host)
		}
	}
	return hosts
}

// zzProbeHostScopedCredentials returns a credential source that issues a
// host-scoped registry token for one host, in addition to a base Terraform
// Cloud credential for app.terraform.io. Credentials are produced through the
// real ForHost path rather than by building a credential value directly, so a
// fix that carries the credential's host inside the credential still works.
func zzProbeHostScopedCredentials(host, token string) *CredentialsSource {
	return &CredentialsSource{
		BaseCredentialSet: BaseCredentialSet{Token: "zz-probe-base-token", Host: "app.terraform.io"},
		FetchToken: func(h string) string {
			if h == host {
				return token
			}
			return ""
		},
	}
}
