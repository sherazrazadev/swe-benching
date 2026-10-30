package functional

import (
	"net/http"
	"os/exec"
	"testing"

	"github.com/argoproj/argo-cd/v3/util/git"
	"github.com/argoproj/argo-cd/v3/util/proxy"
	"github.com/stretchr/testify/require"
)

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

func proxyEnv(t *testing.T, proxyValue string) []string {
	t.Helper()
	cmd := exec.Command("/bin/true")
	cmd.Env = []string{"PATH=/usr/bin:/bin"}
	return proxy.UpsertEnv(cmd, proxyValue, "example.com")
}

// TestHTTPClientValidProxyIsUsed keeps the HTTP repository client using a well-formed proxy.
func TestHTTPClientValidProxyIsUsed(t *testing.T) {
	for name, value := range map[string]string{
		"http":   "http://proxy.example.com:3128",
		"https":  "https://proxy.example.com:3128",
		"socks5": "socks5://proxy.example.com:1080",
	} {
		t.Run(name, func(t *testing.T) {
			got, used := proxyCallback(t, value)
			require.True(t, used, "a well-formed proxy must still be configured on the client")
			require.Equal(t, value, got)
		})
	}
}

// TestSubprocessProxyEnvironmentKeepsValidProxy keeps the shared helper adding a well-formed
// proxy to a subprocess environment, including SOCKS5.
func TestSubprocessProxyEnvironmentKeepsValidProxy(t *testing.T) {
	for _, value := range []string{
		"http://proxy.example.com:3128",
		"https://proxy.example.com:3128",
		"socks5://proxy.example.com:1080",
	} {
		t.Run(value, func(t *testing.T) {
			env := proxyEnv(t, value)
			require.Contains(t, env, "http_proxy="+value)
			require.Contains(t, env, "https_proxy="+value)
			require.Contains(t, env, "no_proxy=example.com")
		})
	}
}

// TestSubprocessProxyEnvironmentWithoutProxyUnchanged keeps the shared helper leaving a
// subprocess environment untouched when the repository has no proxy.
func TestSubprocessProxyEnvironmentWithoutProxyUnchanged(t *testing.T) {
	cmd := exec.Command("/bin/true")
	cmd.Env = []string{"PATH=/usr/bin:/bin", "KEEP=1"}
	require.Equal(t, cmd.Env, proxy.UpsertEnv(cmd, "", ""))
}
