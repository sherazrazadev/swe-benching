package zzhtests

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

// A client whose derived address is in the allowlist is served, whether it
// arrives through the bundled proxy or directly from the local machine.
func TestFunc_AllowlistedClientsAreServed(t *testing.T) {
	setTopology(t, true, false)
	engine := productEngine(t)
	withAllowlist(t, []string{"203.0.113.20"})

	for _, tc := range []struct{ name, remote, forwarded string }{
		{"through-bundled-proxy", "127.0.0.1:1234", "203.0.113.20"},
		{"through-bundled-proxy-ipv6", "[::1]:1234", "203.0.113.20"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rec := apiGet(engine, "/api/icp_settings", tc.remote, tc.forwarded, "")
			require.True(t, isSuccess(rec.Code),
				"an allowlisted client must be served, got %d", rec.Code)
		})
	}
}

// A client connecting directly from the local machine is still allowed when the
// allowlist is set.
func TestFunc_DirectLoopbackClientIsServed(t *testing.T) {
	setTopology(t, true, false)
	engine := productEngine(t)
	withAllowlist(t, []string{"203.0.113.20"})

	for _, remote := range []string{"127.0.0.1:1234", "[::1]:1234"} {
		rec := apiGet(engine, "/api/icp_settings", remote, "", "")
		require.True(t, isSuccess(rec.Code),
			"a direct loopback client must still be served (remote %q, got %d)", remote, rec.Code)
	}
}

// When the bundled proxy is disabled, a loopback peer is not implicitly trusted,
// so a forwarded address it presents is not used for the allowlist decision.
func TestFunc_BundledProxyDisabledDoesNotTrustLoopback(t *testing.T) {
	setTopology(t, true, true)
	engine := productEngine(t)
	withAllowlist(t, []string{"203.0.113.20"})

	rec := apiGet(engine, "/api/icp_settings", "127.0.0.1:1234", "198.51.100.20", "")
	require.True(t, isSuccess(rec.Code),
		"a loopback client must not be attributed to a forwarded address when the bundled proxy is off, got %d", rec.Code)
}

// A forwarded client-address header from a peer that is not a trusted proxy is
// ignored, so it cannot satisfy the allowlist.
func TestFunc_UntrustedPeerForwardedHeaderIsIgnored(t *testing.T) {
	setTopology(t, true, false)
	engine := productEngine(t)
	withAllowlist(t, []string{"203.0.113.20"})

	for _, tc := range []struct{ name, forwarded, realIP string }{
		{"forwarded-for", "203.0.113.20", ""},
		{"real-ip", "", "203.0.113.20"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rec := apiGet(engine, "/api/icp_settings", "198.51.100.20:1234", tc.forwarded, tc.realIP)
			require.True(t, isClientError(rec.Code),
				"a forwarded address from an untrusted peer must not grant access, got %d", rec.Code)
		})
	}
}

// The MCP endpoints keep serving clients that the allowlist permits.
func TestFunc_MCPAllowlistedClientIsServed(t *testing.T) {
	engine := mcpEngine(t, []string{"198.51.100.20"})
	_, body := mcpToolsList(engine, "198.51.100.20:1234", "", "")
	require.Contains(t, body, "Missing sessionId",
		"an allowlisted MCP client must reach the message handler")

	engine = mcpEngine(t, nil)
	_, body = mcpToolsList(engine, "198.51.100.20:1234", "", "")
	require.Contains(t, body, "Missing sessionId",
		"an unset allowlist must leave the MCP endpoints open")
}

// A client below the attempt limit is not locked out.
func TestFunc_PasskeyBelowThresholdIsNotLockedOut(t *testing.T) {
	setTopology(t, true, false)
	engine := productEngine(t)
	withAllowlist(t, nil)
	withMaxAttempts(t, 3)
	enablePasskey(t)

	for i := 0; i < 2; i++ {
		rec := passkeyAttempt(engine, "127.0.0.1:1234", "198.51.100.10")
		require.NotEqual(t, http.StatusTooManyRequests, rec.Code,
			"a client below the limit must not be locked out (attempt %d)", i+1)
	}
	rec := passkeyAttempt(engine, "127.0.0.1:1234", "203.0.113.20")
	require.NotEqual(t, http.StatusTooManyRequests, rec.Code,
		"an ordinary client must not be locked out")
}

// An unset allowlist permits requests even when the client address cannot be
// derived; the failure-closed rule applies only when an allowlist is set.
func TestFunc_EmptyAllowlistAllowsRequests(t *testing.T) {
	withAllowlist(t, nil)

	engine := ipWhiteListEngine()
	rec := apiGet(engine, "/probe", "", "", "")
	require.True(t, isSuccess(rec.Code),
		"an unset allowlist must allow the request, got %d", rec.Code)
}
