package security

import (
	"net/http"
	"strings"
	"testing"

	"github.com/argoproj/argo-cd/v3/util/git"
	"github.com/stretchr/testify/require"
)

// proxyCallback returns what the HTTP client built for a repository would use as its proxy for
// a normal outbound request.
func proxyCallback(t *testing.T, proxyValue string) (string, bool) {
	t.Helper()
	client := git.GetRepoHTTPClient("https://example.com/org/repo.git", false, nil, proxyValue, "")
	transport, ok := client.Transport.(*http.Transport)
	require.True(t, ok, "expected an *http.Transport")
	req, err := http.NewRequest(http.MethodGet, "https://example.com/org/repo.git", nil)
	require.NoError(t, err)
	got, err := transport.Proxy(req)
	if err != nil || got == nil {
		return "", false
	}
	return got.String(), true
}

// TestHTTPClientProxyValueIsNotUsed checks that a repository proxy value the product cannot use
// is not configured on the HTTP client that talks to the repository.
func TestHTTPClientProxyValueIsNotUsed(t *testing.T) {
	payload := "http://evil'$(id>" + marker + ")':8080"
	got, used := proxyCallback(t, payload)
	if used {
		require.NotContains(t, got, "evil", "a malformed proxy value was configured on the client")
	}

	for name, value := range map[string]string{
		"port zero":          "http://proxy.example.com:0",
		"port too high":      "http://proxy.example.com:65536",
		"missing port":       "http://proxy.example.com",
		"empty hostname":     "http://:8080",
		"unsupported scheme": "ftp://proxy.example.com:8080",
		"unsafe hostname":    "http://host;name.example.com:8080",
	} {
		t.Run(name, func(t *testing.T) {
			got, used := proxyCallback(t, value)
			if !used {
				return
			}
			require.NotEqual(t, value, got, "an unusable proxy value was configured on the client")
		})
	}
}

// TestSubprocessProxyEnvironmentIsNotUsed checks the shared helper that prepares proxy
// environment variables for subprocesses.
func TestSubprocessProxyEnvironmentIsNotUsed(t *testing.T) {
	payload := "http://evil'$(id>" + marker + ")':8080"
	env := proxyEnv(t, payload)
	for _, e := range env {
		require.NotContains(t, strings.ToLower(e), "evil",
			"a malformed proxy value was put into the subprocess environment")
	}

	for name, value := range map[string]string{
		"port zero":          "http://proxy.example.com:0",
		"port too high":      "http://proxy.example.com:65536",
		"missing port":       "http://proxy.example.com",
		"empty hostname":     "http://:8080",
		"unsupported scheme": "ftp://proxy.example.com:8080",
	} {
		t.Run(name, func(t *testing.T) {
			env := proxyEnv(t, value)
			for _, e := range env {
				require.NotContains(t, strings.ToLower(e), strings.ToLower(value),
					"an unusable proxy value was put into the subprocess environment")
			}
		})
	}
}
