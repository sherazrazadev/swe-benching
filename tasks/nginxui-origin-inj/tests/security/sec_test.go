package zzhtests

import (
	"net/http"
	"testing"

	cfgsettings "github.com/0xJacky/Nginx-UI/settings"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func isClientError(code int) bool { return code >= 400 && code < 500 }

func isSuccess(code int) bool { return code >= 200 && code < 300 }

// A request that arrives through the deployment's own bundled proxy must be
// attributed to the client that the proxy reports, so the allowlist decides on
// the real client rather than on the proxy's loopback address.
func TestSec_BundledProxyUsesDerivedClientForAllowlist(t *testing.T) {
	setTopology(t, true, false)
	engine := productEngine(t)
	withAllowlist(t, []string{"203.0.113.20"})

	cases := []struct {
		name      string
		remote    string
		forwarded string
		realIP    string
	}{
		{"forwarded-ipv4", "127.0.0.1:1234", "198.51.100.20", ""},
		{"real-ip-header", "127.0.0.1:1234", "", "198.51.100.20"},
		{"forwarded-ipv6-peer", "[::1]:1234", "2001:db8::20", ""},
		{"multi-hop", "127.0.0.1:1234", "203.0.113.99, 198.51.100.10", ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := apiGet(engine, "/api/icp_settings", tc.remote, tc.forwarded, tc.realIP)
			require.True(t, isClientError(rec.Code),
				"a client outside the allowlist must be refused, got %d (%s)", rec.Code, tc.name)
		})
	}
}

// When the client address cannot be derived from the request, the request must
// not be treated as trusted.
func TestSec_UndeterminableClientAddressIsNotTrusted(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withAllowlist(t, []string{"203.0.113.20"})

	engine := ipWhiteListEngine()

	for _, remote := range []string{"", "not-an-address"} {
		rec := apiGet(engine, "/probe", remote, "", "")
		require.True(t, isClientError(rec.Code),
			"an undeterminable client address must not be allowed (remote %q, got %d)", remote, rec.Code)
	}
}

func mcpEngine(t *testing.T, allowlist []string) *gin.Engine {
	t.Helper()
	setTopology(t, true, false)
	engine := productEngine(t)
	withAllowlist(t, allowlist)
	original := cfgsettings.NodeSettings.Secret
	t.Cleanup(func() { cfgsettings.NodeSettings.Secret = original })
	cfgsettings.NodeSettings.Secret = "mcp-test-secret"
	return engine
}

func mcpToolsList(engine *gin.Engine, remote, forwardedFor, realIP string) (int, string) {
	req := newMCPToolsListRequest(remote, forwardedFor, realIP)
	rec := serve(engine, req)
	return rec.Code, rec.Body.String()
}

func newMCPToolsListRequest(remote, forwardedFor, realIP string) *http.Request {
	req := newRequest(http.MethodPost, "/mcp_message", `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`)
	req.RemoteAddr = remote
	req.Header.Set("X-Node-Secret", "mcp-test-secret")
	if forwardedFor != "" {
		req.Header.Set("X-Forwarded-For", forwardedFor)
	}
	if realIP != "" {
		req.Header.Set("X-Real-IP", realIP)
	}
	return req
}

// A forwarded client-address header presented by a peer that is not a trusted
// proxy must not let the request reach the MCP endpoints past the allowlist.
func TestSec_MCPRouteIgnoresForwardedAddressFromUntrustedPeer(t *testing.T) {
	engine := mcpEngine(t, []string{"203.0.113.20"})

	cases := []struct{ name, forwarded, realIP string }{
		{"forwarded-for", "203.0.113.20", ""},
		{"real-ip", "", "203.0.113.20"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			code, body := mcpToolsList(engine, "198.51.100.20:1234", tc.forwarded, tc.realIP)
			require.True(t, isClientError(code),
				"a spoofed forwarded address must not pass the MCP allowlist, got %d", code)
			require.NotContains(t, body, "Missing sessionId",
				"the spoofed request reached the MCP message handler")
		})
	}
}

// A failed passkey sign-in attempt is attributed to the derived client address,
// so one client's failures never lock another client out.
func TestSec_PasskeyLockoutIsPerClient(t *testing.T) {
	setTopology(t, true, false)
	engine := productEngine(t)
	withAllowlist(t, nil)
	withMaxAttempts(t, 3)
	enablePasskey(t)

	attacker := "198.51.100.10"
	for i := 0; i < 3; i++ {
		rec := passkeyAttempt(engine, "127.0.0.1:1234", attacker)
		require.NotEqual(t, http.StatusTooManyRequests, rec.Code,
			"client must not be locked out before reaching the limit (attempt %d)", i+1)
	}

	// The offending client is now locked out.
	rec := passkeyAttempt(engine, "127.0.0.1:1234", attacker)
	require.Equal(t, http.StatusTooManyRequests, rec.Code,
		"the client that exceeded the limit must be locked out")

	// A different client arriving through the same proxy is not affected.
	other := passkeyAttempt(engine, "127.0.0.1:1234", "203.0.113.20")
	require.NotEqual(t, http.StatusTooManyRequests, other.Code,
		"another client must not inherit the first client's lockout")
}
